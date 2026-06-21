from __future__ import annotations
import uuid
import time
import struct
import threading
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import Response, JSONResponse

from ..models.metadata import (
    MetadataFileInfo, EditAction, BulkReplaceRequest,
    EditRequest, EditProject,
)
from ..services.parser import parse_metadata, read_string_entry
from ..services.builder import rebuild_metadata

router = APIRouter()

_sessions: dict[str, dict] = {}
_MAX_SESSIONS = 10
_SESSION_TTL = 1800  # 30 minutes


def _cleanup_sessions():
    while True:
        time.sleep(300)
        now = time.time()
        stale = [sid for sid, s in list(_sessions.items()) if now - s.get("created_at", 0) > _SESSION_TTL]
        for sid in stale:
            del _sessions[sid]


t = threading.Thread(target=_cleanup_sessions, daemon=True)
t.start()


def _get_string_value(data: bytes, header, index: int, edits: dict[int, str]) -> str:
    if index in edits:
        return edits[index]
    return read_string_entry(data, header, index)


def _read_string_chunk(data: bytes, header, offset: int, limit: int, edits: dict[int, str]):
    strings = []
    count = header.stringCount
    for i in range(offset, min(offset + limit, count)):
        if i in edits:
            value = edits[i]
            str_off = 0
        else:
            str_off = struct.unpack_from("<i", data, header.stringOffset + i * 4)[0]
            abs_off = header.stringOffset + str_off
            end = data.find(b"\x00", abs_off)
            value = data[abs_off:end].decode("utf-8", errors="replace") if end != -1 else data[abs_off:].decode("utf-8", errors="replace")
        strings.append({"index": i, "offset": str_off, "value": value})
    return strings


@router.post("/upload")
async def upload_metadata(file: UploadFile = File(...)):
    data = await file.read()
    parsed, err = parse_metadata(data, file.filename or "global-metadata.dat", skip_strings=True)
    if err or parsed is None:
        raise HTTPException(400, err or "Invalid or unsupported global-metadata.dat file")

    if len(_sessions) >= _MAX_SESSIONS:
        oldest = min(_sessions, key=lambda sid: _sessions[sid].get("created_at", 0))
        del _sessions[oldest]

    session_id = str(uuid.uuid4())

    _sessions[session_id] = {
        "original_data": data,
        "header": parsed.header,
        "stringLiterals": parsed.stringLiterals,
        "fileName": parsed.fileName,
        "fileSize": parsed.fileSize,
        "edits": {},
        "literal_edits": {},
        "history": [],
        "created_at": time.time(),
    }

    resp = JSONResponse(content={
        "sessionId": session_id,
        "fileName": parsed.fileName,
        "fileSize": parsed.fileSize,
        "header": parsed.header.model_dump(),
        "stringCount": parsed.header.stringCount,
        "stringLiteralCount": len(parsed.stringLiterals),
    })
    resp.headers["X-Session-Id"] = session_id
    return resp


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    h = session["header"]
    return {
        "fileName": session["fileName"],
        "fileSize": session["fileSize"],
        "header": h.model_dump(),
        "stringCount": h.stringCount,
        "stringLiteralCount": len(session["stringLiterals"]),
    }


@router.post("/edit/{session_id}")
async def edit_string(session_id: str, request: EditRequest):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    if request.target == "stringLiterals":
        lit = session["stringLiterals"][request.index]
        old_value = lit.value
        lit.value = request.newValue
        session["literal_edits"][request.index] = request.newValue
    else:
        old_value = _get_string_value(session["original_data"], session["header"], request.index, session["edits"])
        session["edits"][request.index] = request.newValue

    action = EditAction(
        type="edit",
        target=request.target,
        index=request.index,
        oldValue=old_value,
        newValue=request.newValue,
        timestamp=time.time(),
    )
    session["history"].append(action)

    return action


@router.post("/bulk-replace/{session_id}")
async def bulk_replace(session_id: str, request: BulkReplaceRequest):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    import re as re_mod
    try:
        pattern = re_mod.compile(request.find) if request.useRegex else None
    except re_mod.error:
        raise HTTPException(400, "Invalid regex pattern")
    actions: list[EditAction] = []

    if request.target == "stringLiterals":
        for i, lit in enumerate(session["stringLiterals"]):
            old_val = lit.value
            new_val = pattern.sub(request.replace, old_val) if pattern else old_val.replace(request.find, request.replace)
            if new_val != old_val:
                lit.value = new_val
                session["literal_edits"][i] = new_val
                actions.append(EditAction(
                    type="edit", target="stringLiterals", index=i,
                    oldValue=old_val, newValue=new_val, timestamp=time.time(),
                ))
    else:
        data = session["original_data"]
        header = session["header"]
        edits = session["edits"]
        count = header.stringCount
        for i in range(count):
            old_val = _get_string_value(data, header, i, edits)
            new_val = pattern.sub(request.replace, old_val) if pattern else old_val.replace(request.find, request.replace)
            if new_val != old_val:
                edits[i] = new_val
                actions.append(EditAction(
                    type="edit", target="strings", index=i,
                    oldValue=old_val, newValue=new_val, timestamp=time.time(),
                ))

    session["history"].extend(actions)
    return {"actions": actions}


@router.get("/history/{session_id}")
async def get_history(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return {"history": session["history"]}


@router.post("/undo/{session_id}")
async def undo(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not session["history"]:
        raise HTTPException(400, "Nothing to undo")

    action = session["history"].pop()
    idx = action.index

    if action.target == "stringLiterals":
        session["stringLiterals"][idx].value = action.oldValue
        session["literal_edits"].pop(idx, None)
    else:
        session["edits"].pop(idx, None)

    return {"undone": action}


@router.post("/export-project/{session_id}")
async def export_project(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return EditProject(
        fileName=session["fileName"],
        edits=list(session["history"]),
    )


@router.post("/import-project/{session_id}")
async def import_project(session_id: str, project: EditProject):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    for edit in project.edits:
        idx = edit.index
        if edit.target == "stringLiterals":
            session["stringLiterals"][idx].value = edit.newValue
            session["literal_edits"][idx] = edit.newValue
        else:
            session["edits"][idx] = edit.newValue
        session["history"].append(edit)

    return {"applied": len(project.edits)}


@router.get("/strings/{session_id}")
async def get_strings(session_id: str, offset: int = 0, limit: int = 200):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    chunk = _read_string_chunk(
        session["original_data"], session["header"],
        offset, limit, session["edits"],
    )
    return {
        "total": session["header"].stringCount,
        "offset": offset,
        "limit": limit,
        "strings": chunk,
    }


@router.get("/search/{session_id}")
async def search_strings(session_id: str, q: str = "", offset: int = 0, limit: int = 200, use_regex: bool = False):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    data = session["original_data"]
    header = session["header"]
    edits = session["edits"]
    count = header.stringCount

    if not q:
        chunk = _read_string_chunk(data, header, offset, limit, edits)
        return {"total": count, "offset": offset, "limit": limit, "strings": chunk}

    import re as re_mod
    try:
        if use_regex:
            pattern = re_mod.compile(q, re_mod.IGNORECASE)
            match_fn = lambda v: bool(pattern.search(v))
        else:
            ql = q.lower()
            match_fn = lambda v: ql in v.lower()
    except re_mod.error:
        raise HTTPException(400, "Invalid regex pattern")

    matches: list[dict] = []
    for i in range(count):
        val = _get_string_value(data, header, i, edits)
        if match_fn(val):
            str_off = 0 if i in edits else struct.unpack_from("<i", data, header.stringOffset + i * 4)[0]
            matches.append({"index": i, "offset": str_off, "value": val})
            if len(matches) >= offset + limit:
                break

    total = len(matches)
    chunk = matches[offset:offset + limit]
    return {"total": total, "offset": offset, "limit": limit, "strings": chunk}


@router.get("/string-literals/{session_id}")
async def get_string_literals(session_id: str, offset: int = 0, limit: int = 200):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    literals = session["stringLiterals"]
    chunk = literals[offset:offset + limit]
    return {
        "total": len(literals),
        "offset": offset,
        "limit": limit,
        "strings": [s.model_dump() for s in chunk],
    }


@router.get("/search-literals/{session_id}")
async def search_string_literals(session_id: str, q: str = "", offset: int = 0, limit: int = 200, use_regex: bool = False):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    literals = session["stringLiterals"]
    if not q:
        chunk = literals[offset:offset + limit]
        total = len(literals)
    else:
        import re as re_mod
        try:
            if use_regex:
                pattern = re_mod.compile(q, re_mod.IGNORECASE)
                matches = [s for s in literals if pattern.search(s.value)]
            else:
                ql = q.lower()
                matches = [s for s in literals if ql in s.value.lower()]
        except re_mod.error:
            raise HTTPException(400, "Invalid regex pattern")
        total = len(matches)
        chunk = matches[offset:offset + limit]
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "strings": [s.model_dump() for s in chunk],
    }


@router.api_route("/download/{session_id}", methods=["GET", "POST"])
async def download(session_id: str, request: Request = None):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    data = session["original_data"]
    header = session["header"]
    has_string_edits = bool(session["edits"])
    has_literal_edits = bool(session["literal_edits"])

    if not has_string_edits and not has_literal_edits:
        return Response(content=data, media_type="application/octet-stream",
                        headers={"Content-Disposition": f'attachment; filename="{session["fileName"]}"'})

    if has_string_edits:
        original_strings = [
            _get_string_value(data, header, i, {})
            for i in range(header.stringCount)
        ]
        data = rebuild_metadata(data, original_strings, session["edits"], header)

    if has_literal_edits:
        from ..services.builder import rebuild_string_literals
        data = rebuild_string_literals(data, session["stringLiterals"], session["literal_edits"], header)

    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{session["fileName"]}"'},
    )

from __future__ import annotations
import uuid
import time
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import Response, JSONResponse

from ..models.metadata import (
    MetadataFileInfo, EditAction, BulkReplaceRequest,
    EditRequest, EditProject,
)
from ..services.parser import parse_metadata
from ..services.editor import MetadataEditor
from ..services.builder import rebuild_metadata

router = APIRouter()

_sessions: dict[str, dict] = {}


@router.post("/upload", response_model=MetadataFileInfo)
async def upload_metadata(file: UploadFile = File(...)):
    data = await file.read()
    parsed = parse_metadata(data, file.filename or "global-metadata.dat")
    if parsed is None:
        raise HTTPException(400, "Invalid or unsupported global-metadata.dat file")

    session_id = str(uuid.uuid4())
    string_offsets = _extract_string_offsets(data, parsed.header)

    _sessions[session_id] = {
        "original_data": data,
        "parsed": parsed,
        "string_offsets": string_offsets,
        "string_data_base": parsed.header.stringOffset,
        "header": parsed.header,
        "edits": {},
        "history": [],
    }

    result = parsed.model_dump()
    resp = JSONResponse(content=result)
    resp.headers["X-Session-Id"] = session_id
    return resp


def _extract_string_offsets(data: bytes, header) -> list[int]:
    offsets: list[int] = []
    for i in range(header.stringCount):
        off = int.from_bytes(
            data[header.stringOffset + i * 4:header.stringOffset + i * 4 + 4],
            "little", signed=True,
        )
        offsets.append(off)
    return offsets


@router.get("/session/{session_id}", response_model=MetadataFileInfo)
async def get_session(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session["parsed"]


@router.post("/edit/{session_id}")
async def edit_string(session_id: str, request: EditRequest):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    old_value = session["parsed"].strings[request.index].value
    session["parsed"].strings[request.index].value = request.newValue
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

    editor = MetadataEditor()
    targets = session["parsed"].strings if request.target == "strings" else session["parsed"].stringLiterals
    actions = editor.bulk_replace(targets, request.find, request.replace, request.useRegex)

    for action in actions:
        action.timestamp = time.time()
        session["edits"][action.index] = action.newValue
        if request.target == "strings":
            session["parsed"].strings[action.index].value = action.newValue
        else:
            session["parsed"].stringLiterals[action.index].value = action.newValue

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
    session["parsed"].strings[idx].value = action.oldValue

    if action.index in session["edits"]:
        del session["edits"][action.index]

    return {"undone": action}


@router.post("/export-project/{session_id}")
async def export_project(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    return EditProject(
        fileName=session["parsed"].fileName,
        edits=list(session["history"]),
    )


@router.post("/import-project/{session_id}")
async def import_project(session_id: str, project: EditProject):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    for edit in project.edits:
        idx = edit.index
        session["parsed"].strings[idx].value = edit.newValue
        session["edits"][idx] = edit.newValue
        session["history"].append(edit)

    return {"applied": len(project.edits)}


@router.api_route("/download/{session_id}", methods=["GET", "POST"])
async def download(session_id: str, request: Request = None):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    original_strings = [s.value for s in session["parsed"].strings]

    if not session["edits"]:
        return Response(content=session["original_data"], media_type="application/octet-stream",
                        headers={"Content-Disposition": f'attachment; filename="{session["parsed"].fileName}"'})

    rebuilt = rebuild_metadata(
        session["original_data"],
        original_strings,
        session["edits"],
    )

    return Response(
        content=rebuilt,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{session["parsed"].fileName}"'},
    )

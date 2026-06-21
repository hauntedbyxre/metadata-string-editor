from __future__ import annotations
import struct
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..models.metadata import MetadataHeader


def rebuild_metadata(data: bytes, original_strings: list, string_edits: dict[int, str],
                     header: MetadataHeader | None = None) -> bytes:
    if not string_edits:
        return data

    strings = list(original_strings)
    for idx, new_val in string_edits.items():
        if 0 <= idx < len(strings):
            strings[idx] = new_val

    encoded = [s.encode("utf-8") for s in strings]

    offsets: list[int] = []
    data_size = 0
    for e in encoded:
        offsets.append(data_size)
        data_size += len(e) + 1

    aligned_size = ((data_size + 15) // 16) * 16

    offset_table = bytearray()
    for off in offsets:
        offset_table.extend(struct.pack("<i", off))

    raw_strings = bytearray()
    for e in encoded:
        raw_strings.extend(e)
        raw_strings.extend(b"\x00")
    raw_strings.extend(b"\x00" * (aligned_size - data_size))

    new_section = bytes(offset_table) + bytes(raw_strings)

    old_string_offset = struct.unpack_from("<i", data, 6 * 4)[0]
    string_count = struct.unpack_from("<i", data, 7 * 4)[0]
    old_section_end = _find_section_end(data, old_string_offset, string_count)

    region_before = data[:old_string_offset]
    region_after = data[old_section_end:]

    result = bytearray(region_before + new_section + region_after)
    delta = len(new_section) - (old_section_end - old_string_offset)

    struct.pack_into("<i", result, 6 * 4, old_string_offset)

    header_field_indices = [
        2, 4, 8, 10, 12, 14, 16, 18, 20,
        22, 24, 26, 28, 30, 32, 34, 36,
        38, 40, 42, 44, 46, 48, 50,
    ]

    for idx in header_field_indices:
        byte_off = idx * 4
        if byte_off + 4 > len(result):
            continue
        field_val = struct.unpack_from("<i", result, byte_off)[0]
        if field_val > old_section_end:
            struct.pack_into("<i", result, byte_off, field_val + delta)

    return bytes(result)


def rebuild_string_literals(data: bytes, literals: list, literal_edits: dict[int, str],
                            header: MetadataHeader | None = None) -> bytes:
    if not literal_edits:
        return data

    hdr = header
    if hdr is None:
        hdr = _read_header(data)

    if hdr.stringLiteralCount == 0:
        return data

    encoded = []
    for i, lit in enumerate(literals):
        val = literal_edits.get(i, lit.value)
        encoded.append(val.encode("utf-8"))

    new_literal_list = bytearray()
    running_offset = 0
    for e in encoded:
        new_literal_list.extend(struct.pack("<II", len(e), running_offset))
        running_offset += len(e)

    new_data_size = running_offset
    aligned = new_data_size
    tmp = new_data_size % 4
    if tmp != 0:
        aligned += 4 - tmp

    new_raw_data = bytearray()
    for e in encoded:
        new_raw_data.extend(e)
    while len(new_raw_data) < aligned:
        new_raw_data.extend(b"\x00")

    result = bytearray(data)

    old_data_offset = hdr.stringLiteralDataOffset
    old_data_size = hdr.stringLiteralDataSize

    if aligned <= old_data_size:
        new_data_offset = old_data_offset
        delta_offset = 0
    elif old_data_offset + old_data_size >= len(data):
        new_data_offset = old_data_offset
        delta_offset = 0
    else:
        new_data_offset = len(data)
        delta_offset = (new_data_offset + aligned) - (old_data_offset + old_data_size)

    list_byte_size = hdr.stringLiteralCount * 8
    result[hdr.stringLiteralOffset:hdr.stringLiteralOffset + list_byte_size] = bytes(new_literal_list)

    if new_data_offset == old_data_offset:
        end_pos = new_data_offset + len(new_raw_data)
        if end_pos > len(result):
            result.extend(b"\x00" * (end_pos - len(result)))
        result[new_data_offset:new_data_offset + len(new_raw_data)] = bytes(new_raw_data)
    else:
        old_end = old_data_offset + old_data_size
        before = result[:new_data_offset]
        after = result[old_end:]
        result = bytearray(before + bytes(new_raw_data) + after)

    struct.pack_into("<I", result, 4 * 4, new_data_offset)
    struct.pack_into("<I", result, 5 * 4, aligned)

    if delta_offset != 0:
        header_field_indices = [
            2, 6, 8, 10, 12, 14, 16, 18, 20,
            22, 24, 26, 28, 30, 32, 34, 36,
            38, 40, 42, 44, 46, 48, 50,
        ]
        adjusted_boundary = old_data_offset + old_data_size
        for idx in header_field_indices:
            byte_off = idx * 4
            if byte_off + 4 > len(result):
                continue
            field_val = struct.unpack_from("<i", result, byte_off)[0]
            if field_val >= adjusted_boundary:
                struct.pack_into("<i", result, byte_off, field_val + delta_offset)

    return bytes(result)


def _read_header(data: bytes) -> "MetadataHeader":
    from ..models.metadata import MetadataHeader
    HEADER_FIELD_NAMES = [
        "sanity", "version",
        "stringLiteralOffset", "stringLiteralCount", "stringLiteralDataOffset", "stringLiteralDataSize",
        "stringOffset", "stringCount",
        "eventsOffset", "eventsCount",
        "propertiesOffset", "propertiesCount",
        "methodsOffset", "methodsCount",
        "parameterDefaultValuesOffset", "parameterDefaultValuesCount",
        "fieldDefaultValuesOffset", "fieldDefaultValuesCount",
        "fieldAndParameterDefaultValueDataOffset", "fieldAndParameterDefaultValueDataSize",
        "fieldMarshaledSizesOffset", "fieldMarshaledSizesCount",
        "parametersOffset", "parametersCount",
        "fieldsOffset", "fieldsCount",
        "fieldLayoutsOffset", "fieldLayoutsCount",
        "fieldLayoutFieldIndicesOffset", "fieldLayoutFieldIndicesCount",
        "rgctxEntriesOffset", "rgctxEntriesCount",
        "rgctxRangesOffset", "rgctxRangesCount",
        "genericInstsOffset", "genericInstsCount",
        "genericClassOffset", "genericClassCount",
        "typeDefinitionsOffset", "typeDefinitionsCount",
        "imageDefinitionsOffset", "imageDefinitionsCount",
        "assemblyDefinitionsOffset", "assemblyDefinitionsCount",
        "metadataUsageListsOffset", "metadataUsageListsCount",
        "metadataUsagePairsOffset", "metadataUsagePairsCount",
        "fieldNameToTypeIndexOffset", "fieldNameToTypeIndexCount",
        "fieldNameToTypeDataOffset", "fieldNameToTypeDataCount",
    ]
    num_fields = min(len(data) // 4, len(HEADER_FIELD_NAMES))
    values = [0] * len(HEADER_FIELD_NAMES)
    values[0] = struct.unpack_from("<I", data, 0)[0]
    for i in range(1, num_fields):
        values[i] = struct.unpack_from("<i", data, i * 4)[0]
    return MetadataHeader(**dict(zip(HEADER_FIELD_NAMES, values)))


def _find_section_end(data: bytes, section_offset: int, count: int) -> int:
    if count == 0:
        return section_offset
    offsets_end = section_offset + count * 4
    last_entry_off = struct.unpack_from("<i", data, offsets_end - 4)[0]
    last_str_start = section_offset + last_entry_off
    end = data.find(b"\x00", last_str_start)
    return end + 1 if end != -1 else len(data)

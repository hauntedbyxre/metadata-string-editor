from __future__ import annotations
import struct
from typing import BinaryIO
from ..models.metadata import (
    MetadataHeader, StringEntry, StringLiteralEntry, MetadataFileInfo,
)

EXPECTED_SANITY = 0xFAB11BAF

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


def _read_int32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<i", data, offset)[0]


def _parse_header(data: bytes) -> MetadataHeader | None:
    if len(data) < 8:
        return None
    sanity = _read_int32(data, 0)
    if sanity != EXPECTED_SANITY:
        return None
    num_fields = min(len(data) // 4, len(HEADER_FIELD_NAMES))
    values = [0] * len(HEADER_FIELD_NAMES)
    for i in range(num_fields):
        values[i] = _read_int32(data, i * 4)
    return MetadataHeader(**dict(zip(HEADER_FIELD_NAMES, values)))


def parse_metadata(data: bytes, file_name: str = "global-metadata.dat") -> MetadataFileInfo | None:
    header = _parse_header(data)
    if header is None:
        return None

    strings = _parse_string_table(data, header)
    string_literals = _parse_string_literals(data, header)

    return MetadataFileInfo(
        fileName=file_name,
        fileSize=len(data),
        header=header,
        strings=strings,
        stringLiterals=string_literals,
    )

    strings = _parse_string_table(data, header)
    string_literals = _parse_string_literals(data, header)

    return MetadataFileInfo(
        fileName=file_name,
        fileSize=len(data),
        header=header,
        strings=strings,
        stringLiterals=string_literals,
    )


def _parse_string_table(data: bytes, header: MetadataHeader) -> list[StringEntry]:
    strings: list[StringEntry] = []
    offset_table_start = header.stringOffset
    string_data_base = header.stringOffset

    for i in range(header.stringCount):
        str_offset = _read_int32(data, offset_table_start + i * 4)
        abs_str_offset = string_data_base + str_offset
        end = data.find(b"\x00", abs_str_offset)
        if end == -1:
            value = data[abs_str_offset:].decode("utf-8", errors="replace")
        else:
            value = data[abs_str_offset:end].decode("utf-8", errors="replace")
        strings.append(StringEntry(index=i, offset=str_offset, value=value))

    return strings


def _parse_string_literals(data: bytes, header: MetadataHeader) -> list[StringLiteralEntry]:
    literals: list[StringLiteralEntry] = []
    if header.stringLiteralCount == 0:
        return literals

    for i in range(header.stringLiteralCount):
        offset = header.stringLiteralOffset + i * 8
        length = _read_int32(data, offset)
        data_index_or_value = _read_int32(data, offset + 4)

        if length < 0:
            continue

        if length <= 4095:
            raw = struct.pack("<i", data_index_or_value)[:length]
            value = raw.decode("utf-8", errors="replace")
        else:
            str_data_offset = header.stringLiteralDataOffset + data_index_or_value
            end = data.find(b"\x00", str_data_offset)
            if end == -1:
                value = data[str_data_offset:str_data_offset + length].decode("utf-8", errors="replace")
            else:
                value = data[str_data_offset:end].decode("utf-8", errors="replace")

        literals.append(StringLiteralEntry(index=i, value=value))

    return literals

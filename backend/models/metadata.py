from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class MetadataHeader(BaseModel):
    sanity: int
    version: int
    stringLiteralOffset: int
    stringLiteralCount: int
    stringLiteralDataOffset: int
    stringLiteralDataSize: int
    stringOffset: int
    stringCount: int
    eventsOffset: int
    eventsCount: int
    propertiesOffset: int
    propertiesCount: int
    methodsOffset: int
    methodsCount: int
    parameterDefaultValuesOffset: int
    parameterDefaultValuesCount: int
    fieldDefaultValuesOffset: int
    fieldDefaultValuesCount: int
    fieldAndParameterDefaultValueDataOffset: int
    fieldAndParameterDefaultValueDataSize: int
    fieldMarshaledSizesOffset: int
    fieldMarshaledSizesCount: int
    parametersOffset: int
    parametersCount: int
    fieldsOffset: int
    fieldsCount: int
    fieldLayoutsOffset: int
    fieldLayoutsCount: int
    fieldLayoutFieldIndicesOffset: int
    fieldLayoutFieldIndicesCount: int
    rgctxEntriesOffset: int
    rgctxEntriesCount: int
    rgctxRangesOffset: int
    rgctxRangesCount: int
    genericInstsOffset: int
    genericInstsCount: int
    genericClassOffset: int
    genericClassCount: int
    typeDefinitionsOffset: int
    typeDefinitionsCount: int
    imageDefinitionsOffset: int
    imageDefinitionsCount: int
    assemblyDefinitionsOffset: int
    assemblyDefinitionsCount: int
    metadataUsageListsOffset: int
    metadataUsageListsCount: int
    metadataUsagePairsOffset: int
    metadataUsagePairsCount: int
    fieldNameToTypeIndexOffset: int
    fieldNameToTypeIndexCount: int
    fieldNameToTypeDataOffset: int
    fieldNameToTypeDataCount: int


class StringEntry(BaseModel):
    index: int
    offset: int
    value: str


class StringLiteralEntry(BaseModel):
    index: int
    value: str
    offset: int = 0
    length: int = 0


class MetadataFileInfo(BaseModel):
    fileName: str
    fileSize: int
    header: MetadataHeader
    strings: list[StringEntry]
    stringLiterals: list[StringLiteralEntry]


class EditAction(BaseModel):
    type: str
    target: str
    index: int
    oldValue: str
    newValue: str
    timestamp: float


class BulkReplaceRequest(BaseModel):
    find: str
    replace: str
    useRegex: bool = False
    target: str = "strings"


class EditRequest(BaseModel):
    target: str
    index: int
    newValue: str


class EditProject(BaseModel):
    fileName: str
    edits: list[EditAction]

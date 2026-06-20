export interface MetadataHeader {
  sanity: number;
  version: number;
  stringLiteralOffset: number;
  stringLiteralCount: number;
  stringLiteralDataOffset: number;
  stringLiteralDataSize: number;
  stringOffset: number;
  stringCount: number;
  eventsOffset: number;
  eventsCount: number;
  propertiesOffset: number;
  propertiesCount: number;
  methodsOffset: number;
  methodsCount: number;
  parameterDefaultValuesOffset: number;
  parameterDefaultValuesCount: number;
  fieldDefaultValuesOffset: number;
  fieldDefaultValuesCount: number;
  fieldAndParameterDefaultValueDataOffset: number;
  fieldAndParameterDefaultValueDataSize: number;
  fieldMarshaledSizesOffset: number;
  fieldMarshaledSizesCount: number;
  parametersOffset: number;
  parametersCount: number;
  fieldsOffset: number;
  fieldsCount: number;
  fieldLayoutsOffset: number;
  fieldLayoutsCount: number;
  fieldLayoutFieldIndicesOffset: number;
  fieldLayoutFieldIndicesCount: number;
  rgctxEntriesOffset: number;
  rgctxEntriesCount: number;
  rgctxRangesOffset: number;
  rgctxRangesCount: number;
  genericInstsOffset: number;
  genericInstsCount: number;
  genericClassOffset: number;
  genericClassCount: number;
  typeDefinitionsOffset: number;
  typeDefinitionsCount: number;
  imageDefinitionsOffset: number;
  imageDefinitionsCount: number;
  assemblyDefinitionsOffset: number;
  assemblyDefinitionsCount: number;
  metadataUsageListsOffset: number;
  metadataUsageListsCount: number;
  metadataUsagePairsOffset: number;
  metadataUsagePairsCount: number;
  fieldNameToTypeIndexOffset: number;
  fieldNameToTypeIndexCount: number;
  fieldNameToTypeDataOffset: number;
  fieldNameToTypeDataCount: number;
}

export interface StringEntry {
  index: number;
  offset: number;
  value: string;
}

export interface StringLiteralEntry {
  index: number;
  value: string;
}

export interface MetadataFileInfo {
  fileName: string;
  fileSize: number;
  header: MetadataHeader;
  strings: StringEntry[];
  stringLiterals: StringLiteralEntry[];
}

export interface EditAction {
  type: string;
  target: string;
  index: number;
  oldValue: string;
  newValue: string;
  timestamp: number;
}

export interface BulkReplaceRequest {
  find: string;
  replace: string;
  useRegex: boolean;
  target: string;
}

export interface EditRequest {
  target: string;
  index: number;
  newValue: string;
}

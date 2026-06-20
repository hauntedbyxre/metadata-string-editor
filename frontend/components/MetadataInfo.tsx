import type { MetadataFileInfo } from '../utils/types';

interface Props {
  metadata: MetadataFileInfo;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-1.5 px-3 rounded hover:bg-[var(--bg-tertiary)]">
      <span className="text-[var(--text-secondary)] text-sm">{label}</span>
      <span className="text-[var(--text-primary)] text-sm font-mono">{value}</span>
    </div>
  );
}

export default function MetadataInfo({ metadata }: Props) {
  const h = metadata.header;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">File Info</h3>
        <Field label="Filename" value={metadata.fileName} />
        <Field label="File Size" value={formatSize(metadata.fileSize)} />
        <Field label="Metadata Version" value={h.version} />
        <Field label="Sanity" value={`0x${h.sanity.toString(16).toUpperCase()}`} />
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">String Data</h3>
        <Field label="Strings" value={h.stringCount} />
        <Field label="String Offset" value={`0x${h.stringOffset.toString(16)}`} />
        <Field label="String Literals" value={h.stringLiteralCount} />
        <Field label="String Literal Data Size" value={formatSize(h.stringLiteralDataSize)} />
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Metadata Tables</h3>
        <Field label="Type Definitions" value={h.typeDefinitionsCount} />
        <Field label="Image Definitions" value={h.imageDefinitionsCount} />
        <Field label="Assembly Definitions" value={h.assemblyDefinitionsCount} />
        <Field label="Methods" value={h.methodsCount} />
        <Field label="Fields" value={h.fieldsCount} />
        <Field label="Parameters" value={h.parametersCount} />
        <Field label="Properties" value={h.propertiesCount} />
        <Field label="Events" value={h.eventsCount} />
        <Field label="Generic Insts" value={h.genericInstsCount} />
        <Field label="Generic Class" value={h.genericClassCount} />
        <Field label="RGCTX Entries" value={h.rgctxEntriesCount} />
        <Field label="RGCTX Ranges" value={h.rgctxRangesCount} />
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Default Values</h3>
        <Field label="Field Defaults" value={h.fieldDefaultValuesCount} />
        <Field label="Parameter Defaults" value={h.parameterDefaultValuesCount} />
        <Field label="Default Value Data Size" value={formatSize(h.fieldAndParameterDefaultValueDataSize)} />
        <Field label="Field Marshaled Sizes" value={h.fieldMarshaledSizesCount} />
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Metadata Usage</h3>
        <Field label="Usage Lists" value={h.metadataUsageListsCount} />
        <Field label="Usage Pairs" value={h.metadataUsagePairsCount} />
      </div>

      {h.fieldNameToTypeIndexCount > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Field Name → Type Index</h3>
          <Field label="Entries" value={h.fieldNameToTypeIndexCount} />
          <Field label="Data Size" value={h.fieldNameToTypeDataCount} />
        </div>
      )}
    </div>
  );
}

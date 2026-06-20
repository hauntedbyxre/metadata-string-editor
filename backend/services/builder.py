from __future__ import annotations
import struct


def rebuild_metadata(data: bytes, original_strings: list, string_edits: dict[int, str]) -> bytes:
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

    sanity = struct.unpack_from("<i", data, 0)[0]
    if sanity != 0xFAB11BAF:
        return data

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


def _find_section_end(data: bytes, section_offset: int, count: int) -> int:
    if count == 0:
        return section_offset
    offsets_end = section_offset + count * 4
    last_entry_off = struct.unpack_from("<i", data, offsets_end - 4)[0]
    last_str_start = section_offset + last_entry_off
    end = data.find(b"\x00", last_str_start)
    return end + 1 if end != -1 else len(data)

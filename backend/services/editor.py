from __future__ import annotations
import re
from ..models.metadata import EditAction


class MetadataEditor:
    def __init__(self):
        self._edits: dict[int, str] = {}

    def apply_edit(self, index: int, new_value: str, old_value: str) -> EditAction:
        self._edits[index] = new_value
        return EditAction(
            type="edit",
            target="strings",
            index=index,
            oldValue=old_value,
            newValue=new_value,
            timestamp=0,
        )

    def bulk_replace(
        self,
        strings: list,
        find: str,
        replace: str,
        use_regex: bool = False,
    ) -> list[EditAction]:
        actions: list[EditAction] = []
        pattern = re.compile(find) if use_regex else None

        for entry in strings:
            old_value = entry.value
            if use_regex:
                new_value = pattern.sub(replace, old_value)
            else:
                new_value = old_value.replace(find, replace)

            if new_value != old_value:
                self._edits[entry.index] = new_value
                actions.append(EditAction(
                    type="edit",
                    target="strings",
                    index=entry.index,
                    oldValue=old_value,
                    newValue=new_value,
                    timestamp=0,
                ))

        return actions

    def get_edits(self) -> dict[int, str]:
        return dict(self._edits)

    def clear(self):
        self._edits.clear()

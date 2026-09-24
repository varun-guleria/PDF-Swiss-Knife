---
description: Guidelines for adding empty-state illustrations to workspace tools.
---

# Empty State Illustrations

When adding empty-state illustrations or placeholder graphics to the workspace tools:

1. **Structure**: Place the image inside a dedicated container (e.g., `#<toolId>-illustration-container`) immediately below the dropzone or primary input area.
2. **State Management**: Update the tool's `updateUiState()` function to toggle the container's visibility. Hide the illustration when files/data are present, and show it when the workspace is cleared.
3. **Optical Centering**: The main workspace is offset by the left sidebar. While `text-align: center` will mathematically center the image in the workspace area, you must often apply a `transform: translateX(Xpx)` to visually balance the image, especially if its internal visual weight is asymmetrical or if it needs to align with the global viewport instead of the local container. Always ask the user to verify the optical centering.

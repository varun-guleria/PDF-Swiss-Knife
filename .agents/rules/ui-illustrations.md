# PDF Swiss-Knife: Tool Illustrations Standard

When adding or modifying tool pages (e.g., Split, Merge, Extract) in the PDF Swiss-Knife app, always include a doodle illustration for the empty state. 

**Strict Styling Requirements:**
1. **Container Styling**: The wrapper `<div>` around the illustration must include:
   `style="text-align:center; margin-top:var(--space-8); padding-bottom:var(--space-8); transform:translateX(250px);"`
2. **Image Styling**: The `<img>` tag itself must include:
   `style="max-width:100%; height:auto; max-height:280px; object-fit:contain; opacity:0.9;"`
3. **Visibility Logic**: The illustration must be hidden (`display: none`) the moment a user uploads or selects files, and restored (`display: block`) when the workspace is cleared or reset.

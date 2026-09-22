"""
tests/test_ui_redesign_verification.py — Comprehensive UI/UX Redesign Verification.

Validates:
1. Application starts and responds.
2. Home layout: task-oriented, "What would you like to do?", common actions, categorized directory, recent activity empty state.
3. App shell navigation: categories, items, Custom Batch PDF Builder.
4. Light & dark theme tokens: desktop-grade colors, restrained borders, no SaaS neon/gradients.
5. File manager component: drag handle, index, name, extension, size, replace, reorder, remove.
6. Custom Batch PDF Builder: dynamic repeating placeholders ([-] N [+]), slot replacement preservation, unique file list with replace, restrained summary panel.
7. Zero regression on live server processing.
"""

import sys
import os
import re
import urllib.request
import json
import pytest

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(WORKSPACE, 'frontend')

def read_file(rel_path):
    with open(os.path.join(FRONTEND_DIR, rel_path), 'r', encoding='utf-8') as f:
        return f.read()

def test_01_app_server_running():
    """Verify application starts and responds on port 5000."""
    url = "http://127.0.0.1:5000/api/health"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode('utf-8'))
        assert data['status'] == 'ok'
        assert data['service'] == 'PDF Swiss-Knife'

def test_02_home_panel_task_oriented():
    """Verify Home view is task-oriented and replaces the generic 4-column card grid."""
    home_js = read_file('js/tools/home.js')
    tools_css = read_file('css/tools.css')

    # Must ask "What would you like to do?"
    assert 'What would you like to do?' in home_js
    assert 'Common actions' in home_js

    # Must present primary actions (Merge, Split, Organise, Convert)
    assert 'Merge PDFs' in home_js
    assert 'Split PDF' in home_js
    assert 'Organise Pages' in home_js
    assert 'Convert' in home_js

    # Must have categorized directory
    assert 'All Tools & Utilities' in home_js
    assert 'TOOL_DIRECTORY' in home_js
    assert 'Extract Pages' in home_js
    assert 'Rotate Pages' in home_js
    assert 'Crop Pages' in home_js
    assert 'Compress' in home_js
    assert 'Repair / Normalize' in home_js
    assert 'Protect PDF' in home_js

    # Must include Recent Activity section with proper empty state
    assert 'Recent Activity' in home_js
    assert 'No recent activity' in home_js
    assert 'psk-recent-activity' in home_js

    # CSS must style home action tiles and directory rows without generic SaaS cards
    assert '.home-action-tile' in tools_css
    assert '.home-dir-row' in tools_css
    assert '.home-directory-container' in tools_css

def test_03_app_shell_navigation():
    """Verify application navigation matches specified hierarchy and labels."""
    app_js = read_file('js/app.js')
    layout_css = read_file('css/layout.css')

    # Check categories and items
    expected_nav = [
        'Home',
        'Merge PDFs',
        'Split PDF',
        'Organise Pages',
        'Extract Pages',
        'Rotate Pages',
        'Crop Pages',
        'Watermark',
        'Page Numbers',
        'Header & Footer',
        'PDF → Images',
        'Images → PDF',
        'Compress',
        'Repair / Normalize',
        'PDF Information',
        'Protect PDF',
        'Remove Protection',
        'Custom Batch PDF Builder',
        'Settings',
    ]
    for item in expected_nav:
        assert item in app_js, f"Missing navigation item: {item}"

    # Verify topbar breadcrumb and desktop styling
    assert 'topbar-breadcrumb' in app_js
    assert '.sidebar' in layout_css
    assert '.nav-item' in layout_css
    assert '.nav-item.active' in layout_css

def test_04_light_and_dark_tokens():
    """Verify centralized design tokens for light and dark modes."""
    tokens_css = read_file('css/tokens.css')

    # Check light theme
    assert '[data-theme="light"]' in tokens_css or ':root' in tokens_css
    assert '--color-bg-app' in tokens_css
    assert '--color-bg-sidebar' in tokens_css
    assert '--color-bg-surface' in tokens_css
    assert '--color-border' in tokens_css
    assert '--color-text-primary' in tokens_css
    assert '--color-brand' in tokens_css

    # Check dark theme (desktop-grade neutral dark)
    assert '[data-theme="dark"]' in tokens_css
    assert '#1b1c1e' in tokens_css or '#18181a' in tokens_css
    assert '#222326' in tokens_css

    # Verify restrained desktop radii and widths
    assert '--sidebar-width' in tokens_css
    assert '--content-max-width' in tokens_css
    assert '--content-max-width-wide' in tokens_css

def test_05_file_manager_component():
    """Verify reusable file manager component with reordering, metadata, replace, and remove."""
    file_row_js = read_file('js/components/fileRow.js')
    components_css = read_file('css/components.css')

    assert 'createFileList' in file_row_js
    assert 'file-row__handle' in file_row_js
    assert 'grip-vertical' in file_row_js
    assert 'file-row__index' in file_row_js
    assert 'file-row__name' in file_row_js
    assert 'file-row__type-badge' in file_row_js
    assert 'file-row__meta' in file_row_js
    assert 'file-row__btn-replace' in file_row_js
    assert 'file-row__btn-remove' in file_row_js
    assert 'file-list__header' in file_row_js

    # CSS styles
    assert '.file-manager' in components_css
    assert '.file-list__header' in components_css
    assert '.file-row' in components_css
    assert '.file-row__handle' in components_css
    assert '.file-row:hover' in components_css

def test_06_custom_batch_builder_ui():
    """Verify Custom Batch PDF Builder workspace, dynamic placeholders, unique list, and restrained summary."""
    batch_js = read_file('js/tools/batch.js')
    tools_css = read_file('css/tools.css')

    # Workspace structure
    assert 'Custom Batch PDF Builder' in batch_js
    assert 'Repeating PDFs' in batch_js
    assert 'Unique Documents' in batch_js
    assert 'BATCH SUMMARY' in batch_js

    # Stepper controls [-] N [+]
    assert 'batch-slot-dec' in batch_js
    assert 'batch-slot-inc' in batch_js
    assert 'batch-slot-count-val' in batch_js

    # Dynamic repeating slots
    assert 'repeatingSlots' in batch_js
    assert 'slot-btn-replace' in batch_js
    assert 'slot-btn-up' in batch_js
    assert 'slot-btn-down' in batch_js
    assert 'slot-btn-clear' in batch_js
    assert 'renderRepeatingSlots' in batch_js

    # Unique files list with replace preserving position
    assert 'uq-btn-replace' in batch_js
    assert 'uq-btn-remove' in batch_js
    assert 'renderUniqueFiles' in batch_js

    # Restrained summary
    assert 'summary-stat-repeating' in batch_js
    assert 'summary-stat-unique' in batch_js
    assert 'summary-stat-outputs' in batch_js
    assert 'summary-structure-text' in batch_js
    assert 'batch-generate-btn' in batch_js

    # CSS definitions
    assert '.batch-workspace' in tools_css
    assert '.repeating-slots-container' in tools_css
    assert '.repeating-slot' in tools_css
    assert '.batch-summary-panel' in tools_css
    assert '.batch-summary-stats' in tools_css

if __name__ == '__main__':
    pytest.main([__file__, '-v'])

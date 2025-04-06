const vscode = require('vscode');

// Store decorations
let activeDecorationType = null;
let isHighlightingEnabled = true;

// Cell delimiter pattern - match both #%% and # %% with optional spaces and text after
const CELL_DELIMITER = /^#\s*%%\s*/;

/**
 * Activate the extension
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Python Cell Highlighter is now active');

    // Register the toggle command
    let toggleCommand = vscode.commands.registerCommand('pythonCellHighlighter.toggleHighlighting', () => {
        isHighlightingEnabled = !isHighlightingEnabled;
        
        if (isHighlightingEnabled) {
            vscode.window.showInformationMessage('Cell highlighting enabled');
            updateHighlighting(vscode.window.activeTextEditor);
        } else {
            vscode.window.showInformationMessage('Cell highlighting disabled');
            clearHighlighting();
        }
    });

    // Event handler for cursor position change
    let cursorChangeDisposable = vscode.window.onDidChangeTextEditorSelection(event => {
        if (isHighlightingEnabled && event.textEditor.document.languageId === 'python') {
            updateHighlighting(event.textEditor);
        }
    });

    // Event handler for active editor change
    let editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (isHighlightingEnabled && editor && editor.document.languageId === 'python') {
            updateHighlighting(editor);
        }
    });

    // Handle configuration changes
    let configChangeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('pythonCellHighlighter') && isHighlightingEnabled) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'python') {
                updateHighlighting(editor);
            }
        }
    });

    context.subscriptions.push(
        toggleCommand,
        cursorChangeDisposable,
        editorChangeDisposable,
        configChangeDisposable
    );
    
    // Initialize if a Python editor is already open
    if (vscode.window.activeTextEditor && 
        vscode.window.activeTextEditor.document.languageId === 'python') {
        updateHighlighting(vscode.window.activeTextEditor);
    }
}

/**
 * Find cell boundaries from cursor position
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} cursorPosition
 * @returns {Object} cell boundaries
 */
function findCellBoundaries(document, cursorPosition) {
    const lineCount = document.lineCount;
    let startLine = cursorPosition.line;
    let endLine = cursorPosition.line;
    
    console.log(`Finding cell boundaries for cursor at line ${cursorPosition.line}`);
    
    // Check if current line is a delimiter
    const currentLineText = document.lineAt(cursorPosition.line).text;
    const isCurrentLineDelimiter = CELL_DELIMITER.test(currentLineText);
    console.log(`Current line is delimiter: ${isCurrentLineDelimiter}`);
    
    // If cursor is on a delimiter line, this is the START of a cell
    if (isCurrentLineDelimiter) {
        // This line is the start of the current cell - no need to search backwards
        console.log(`Cursor is on a delimiter line, using it as cell start`);
    } else {
        // Find the start line of the current cell (search backwards)
        while (startLine > 0) {
            const line = document.lineAt(startLine - 1);
            console.log(`Checking line ${startLine - 1}: "${line.text.substring(0, 10)}..."`);
            if (CELL_DELIMITER.test(line.text)) {
                console.log(`Found start delimiter at line ${startLine - 1}`);
                startLine--; // Include the delimiter in the current cell
                break;
            }
            startLine--;
        }
    }
    
    // Find the end line of the current cell (search forwards)
    while (endLine < lineCount - 1) {
        const line = document.lineAt(endLine + 1);
        console.log(`Checking forward line ${endLine + 1}: "${line.text.substring(0, 10)}..."`);
        if (CELL_DELIMITER.test(line.text)) {
            console.log(`Found end delimiter at line ${endLine + 1}`);
            break;
        }
        endLine++;
    }
    
    console.log(`Final cell boundaries: ${startLine} to ${endLine}`);
    
    return {
        start: new vscode.Position(startLine, 0),
        end: document.lineAt(endLine).range.end
    };
}

/**
 * Update highlighting for the current cell
 * @param {vscode.TextEditor} editor
 */
function updateHighlighting(editor) {
    if (!editor || editor.document.languageId !== 'python') {
        console.log('Not highlighting - not a Python editor or no editor active');
        return;
    }

    // Clear previous decoration
    clearHighlighting();
    
    // Get the cursor position
    const cursorPosition = editor.selection.active;
    console.log(`Cursor position: Line ${cursorPosition.line}`);
    
    // Find cell boundaries
    const cellBoundaries = findCellBoundaries(editor.document, cursorPosition);
    console.log(`Cell boundaries found: Lines ${cellBoundaries.start.line} to ${cellBoundaries.end.line}`);
    
    // Get color from configuration
    const config = vscode.workspace.getConfiguration('pythonCellHighlighter');
    const backgroundColor = config.get('backgroundColor');
    
    // Create decoration type
    activeDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: backgroundColor,
        isWholeLine: true
    });
    
    // Apply decoration
    const decorationRange = new vscode.Range(cellBoundaries.start, cellBoundaries.end);
    editor.setDecorations(activeDecorationType, [decorationRange]);
    console.log(`Applied decoration to range: Lines ${decorationRange.start.line} to ${decorationRange.end.line}`);
}

/**
 * Clear all cell highlighting
 */
function clearHighlighting() {
    if (activeDecorationType) {
        // Remove all decorations
        vscode.window.activeTextEditor?.setDecorations(activeDecorationType, []);
        activeDecorationType.dispose();
        activeDecorationType = null;
    }
}

function deactivate() {
    clearHighlighting();
}

module.exports = {
    activate,
    deactivate
};

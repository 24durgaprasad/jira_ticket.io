// DOM Elements
const form = document.getElementById('generator-form');
const submitBtn = document.getElementById('submit-btn');
const fileInput = document.getElementById('requirementsFile');
const fileNameDisplay = document.getElementById('file-name');
const statusArea = document.getElementById('status-area');
const statusHeader = document.getElementById('status-header');
const statusContent = document.getElementById('status-content');

// Helper to show status
function showStatus(type, title, message) {
    statusArea.style.display = 'block';
    statusHeader.innerHTML = type === 'loading'
        ? `<span class="loader"></span> ${title}`
        : title;

    // Color coding based on type
    if (type === 'error') {
        statusHeader.style.color = 'var(--error-color)';
    } else if (type === 'success') {
        statusHeader.style.color = 'var(--success-color)';
    } else {
        statusHeader.style.color = 'var(--accent-color)';
    }

    statusContent.innerHTML = message; // Allow HTML for formatted results
}

// File Input Change Handler
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        fileNameDisplay.textContent = `Selected: ${file.name}`;
        fileNameDisplay.style.display = 'block';
        // Add dragover class simply for visual confirmation if needed, or just leave it
    }
});

// Drag and Drop Visuals
const fileLabel = document.querySelector('.file-upload-label');
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileLabel.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    fileLabel.addEventListener(eventName, () => fileLabel.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    fileLabel.addEventListener(eventName, () => fileLabel.classList.remove('dragover'), false);
});

fileLabel.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    fileInput.files = files;
    // Trigger change event manually
    const event = new Event('change');
    fileInput.dispatchEvent(event);
});

// Form Submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset status
    statusArea.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating Tickets...';

    // Show loading
    showStatus('loading', 'Analyzing Requirements...', 'Connecting to AI and Jira...');

    const formData = new FormData(form);

    try {
        const response = await fetch('/api/generate-tickets', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Unknown error occurred');
        }

        // Success Formatting
        let successHtml = `<p>${data.message}</p>`;

        if (data.stats) {
            successHtml += `
                <ul style="margin-top: 10px; list-style-position: inside;">
                    <li><strong>Epics Found:</strong> ${data.stats.epics}</li>
                    <li><strong>Parent Epic Key:</strong> ${data.stats.parentEpic || 'N/A'}</li>
                </ul>
            `;
        }

        if (data.jira && data.jira.childEpics && data.jira.childEpics.length > 0) {
            successHtml += `<div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                <strong>Created Tickets:</strong>
                <ul style="margin-top: 5px; font-size: 0.9em; padding-left: 20px;">
                    ${data.jira.childEpics.map(epic => `
                        <li>
                            Epic: <strong>${epic.epicKey}</strong>
                            <ul>
                                ${epic.stories.map(story => `<li>${story}</li>`).join('')}
                            </ul>
                        </li>
                    `).join('')}
                </ul>
            </div>`;
        }

        showStatus('success', 'Tickets Created Successfully!', successHtml);

    } catch (error) {
        console.error('Error:', error);
        showStatus('error', 'Generation Failed', error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate Tickets';
    }
});

const DEBUG_ALERTS = false;   // ← flip to true when you want diagnostics

// Configure Marked safely (same as news)
marked.setOptions({
    mangle: false,
    headerIds: false,
    breaks: true
});

// Disable code blocks and inline code
const alertRenderer = {
    code() { return ""; },
    codespan() { return ""; }
};
marked.use({ renderer: alertRenderer });

async function loadAlerts() {
    const container = document.getElementById("alerts");
    if (!container) return;

    try {
        const response = await fetch("/alerts/index.json");
        const items = await response.json();

        if (DEBUG_ALERTS) {
            console.log("RAW items from index.json:", items);
        }

        const today = new Date();

        // Normalise dates
        items.forEach(item => {
            item.start = (item.start || "").trim();
            item.end   = (item.end   || "").trim();
        });

        // Filter active alerts
        const active = items.filter(item => {
            const start = new Date(item.start);
            const end   = new Date(item.end);
            return today >= start && today <= end;
        });

        if (DEBUG_ALERTS) {
            console.log("Active BEFORE sort:", active.map(a => `${a.start} ${a.file}`));
        }

        if (active.length === 0) return;

        // Sort by actual Date, newest first
        active.sort((a, b) => new Date(b.start) - new Date(a.start));

        if (DEBUG_ALERTS) {
            console.log("Active AFTER sort:", active.map(a => `${a.start} ${a.file}`));
        }

        // Load each alert file
        let messages = [];

        for (const item of active) {
            const url = `/alerts/${item.file}`;
            if (DEBUG_ALERTS) console.log("Fetching alert file:", url);

            const md = await fetch(url).then(r => r.text());

            // Strip YAML
            const content = md.replace(/^---[\s\S]*?---/, "").trim();

            if (DEBUG_ALERTS) {
                console.log("Content for", item.file, "=>", content);
            }

            // Convert Markdown → HTML
            messages.push(`<div class="alert-item">${marked.parse(content)}</div>`);
        }

        // Build combined banner
        container.innerHTML = `
            <div class="alert">
                <span class="closebtn" onclick="this.parentElement.style.display='none';">&times;</span>
                ${messages.join("")}
            </div>
        `;

    } catch (err) {
        console.error("Error loading alerts:", err);
    }
}

loadAlerts();

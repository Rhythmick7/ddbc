// Configure Marked safely
marked.setOptions({
    mangle: false,
    headerIds: false,
    breaks: true
});
const renderer = {
    code() {
        return ""; // remove code blocks entirely
    },
    codespan() {
        return ""; // remove inline code entirely
    }
};

marked.use({ renderer });

function extractDateFromFilename(filename) {
    return filename.substring(0, 10); // "YYYY-MM-DD"
}
// Location of index.json
const INDEX_URL = "/news/index.json";

// Where to insert the rendered news items
const NEWS_CONTAINER = document.getElementById("news");

// Format date nicely (optional)
function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

async function loadNews() {
    try {
        const response = await fetch("/news/index.json");
        const items = await response.json();

        const today = new Date();

        const visibleItems = items.filter(item => {
            const start = new Date(item.start  + "T00:00:00");
            const end = new Date(item.end  + "T23:59:59");
            return today >= start && today <= end;
        });

        visibleItems.sort((a, b) => b.start.localeCompare(a.start));

        for (const item of visibleItems) {
            const mdUrl = `/news/published/${item.file}`;
            const mdResponse = await fetch(mdUrl);
            const mdText = await mdResponse.text();

            // Strip YAML
            const content = mdText.replace(/^---[\s\S]*?---/, "").trim();

            // Convert Markdown → HTML
            const html = marked.parse(content);

            // Build block
            const block = document.createElement("div");
            block.className = "news-item";

            const pubDate = extractDateFromFilename(item.file);
            const endDateObj = new Date(item.end);

            // Calculate days until expiry
            const msPerDay = 1000 * 60 * 60 * 24;
            const daysToEnd = Math.ceil((endDateObj - today) / msPerDay);

            let expiryLine = "";

            // Only show expiry if within 30 days
            if (daysToEnd <= 30 && daysToEnd >= 0) {
                if (daysToEnd === 0) {
                    expiryLine = "expires today<br>";
                } else if (daysToEnd === 1) {
                    expiryLine = "expires tomorrow<br>";
                } else {
                    expiryLine = `expires in ${daysToEnd} days<br>`;
                }
            }

            block.innerHTML = `
                ${html}
                <p class="news-footer">
                    by: ${item.author}<br>
                    on: ${formatDate(pubDate)}<br>
                    ${expiryLine}
                </p>
                <hr>
            `;

            NEWS_CONTAINER.appendChild(block);
        }

    } catch (err) {
        console.error("Error loading news:", err);
    }
}

loadNews();


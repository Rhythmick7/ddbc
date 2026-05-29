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
            const start = new Date(item.start);
            const end = new Date(item.end);
            return today >= start && today <= end;
        });

        visibleItems.sort((a, b) => b.start.localeCompare(a.start));

        for (const item of visibleItems) {
            const mdUrl = `/news/${item.file}`;
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
            const endDate = item.end;

            block.innerHTML = `
                ${html}
                <p class="news-footer">
                    by: ${item.author}<br>
                    on: ${formatDate(pubDate)}<br>
                    ends: ${formatDate(endDate)}
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


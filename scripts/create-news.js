// Slugify title (no spaces)
function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sendEmail() {
    const title = document.getElementById("title").value.trim();
    const author = document.getElementById("author").value.trim();
    const body = document.getElementById("body").value.trim();

    if (!title || !author || !body) {
        alert("Please fill in Title, Name and Story before sending.");
        return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0, 10);

    const safeTitle = slugify(title);

    const yaml =
`---
title: ${safeTitle}
start: ${today}
end: ${end}
author: ${author}
---
`;

const content =
`${yaml}
# ${title}

${body}

------------------------------
`;

    openEmail(content);
}

function openEmail(content) {
    const email = "ddbcsecretary@gmail.com";
    const title = document.getElementById("title").value.trim();
    const subject = encodeURIComponent("News Submission: " + title);
    const body = encodeURIComponent(content);

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

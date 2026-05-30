// Show inline previews for multiple photos
function previewPhotos() {
    const files = document.getElementById("photos").files;
    const area = document.getElementById("preview-area");
    area.innerHTML = "";

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = document.createElement("img");
            img.src = e.target.result;
            img.className = "preview-img";
            area.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

// Resize/compress image
function resizeImage(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const maxSize = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height && width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                const compressed = canvas.toDataURL("image/jpeg", 0.8);
                resolve(compressed);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Slugify title (no spaces)
function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function sendEmail() {
    const title = document.getElementById("title").value.trim();
    const author = document.getElementById("author").value.trim();
    const body = document.getElementById("body").value.trim();
    const files = document.getElementById("photos").files;

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

    let content = `${yaml}\n${body}\n\n`;

    // Process multiple photos
    if (files.length > 0) {
        content += "[Attached Photos Below]\n\n";

        for (const file of files) {
            const compressed = await resizeImage(file);
            content += `${compressed}\n\n`;
        }
    }

    openEmail(content);
}

function openEmail(content) {
    const email = "ddbcsecretary@gmail.com";
    const title = document.getElementById("title").value.trim();
    const subject = encodeURIComponent("News Submission: " + title);
    const body = encodeURIComponent(content);

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}
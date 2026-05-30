function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildPayload() {
  const title = document.getElementById("title").value.trim();
  const author = document.getElementById("author").value.trim();
  const body = document.getElementById("body").value.trim();

  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0, 10);

  const safeTitle = slugify(title);
  const filename = `${today}-${safeTitle}.txt`;

  const yaml =
`---
title: ${safeTitle}
start: ${today}
end: ${end}
author: ${author}
---
`;

const fullMessage =
`==============================
 COPY EVERYTHING BELOW THIS LINE
==============================

FILENAME: ${filename}

---
title: ${safeTitle}
start: ${today}
end: ${end}
author: ${author}
---

# ${title}

${body}
`;

  document.getElementById("payload").value = fullMessage;

  return true; // allow form to submit
}


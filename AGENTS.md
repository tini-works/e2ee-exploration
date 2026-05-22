<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Rules

- Don't use `confirm` dialogs, use `toast` or custom modals instead.
- We are developing features, so don't have to worry about migration data (We can delete records and start from scratch).

## Features

- IMPORTANT: Don't allow users to use functions if they have not entered correctly their recovery key

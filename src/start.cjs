// This is a simple CommonJS file designed to start serveit in an environment where index.js is ran through an intermediary script
// (such as on lightspeed cpanel).
// It uses CommonJS's dynamic import to import index.js (an ES Module).

(async () => {
    const serveit = await import('./index.js');
})().catch(err => console.error(err));
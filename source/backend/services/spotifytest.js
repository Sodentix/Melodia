// randomPreview.js

import fetch from "node-fetch";
const CLIENT_ID = '8ccbbc2c44a24c4ba9dd97df70431ca7';
const CLIENT_SECRET = '27dffc07fdf141ca9a66bd8d6cedc824';

async function getAccessToken() {
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });
    const data = await res.json();
    return data.access_token;
}

async function getRandomPreview() {
    const token = await getAccessToken();

    // pick a random letter
    const randomLetter = String.fromCharCode(97 + Math.floor(Math.random() * 26));
    const query = encodeURIComponent(randomLetter);

    const res = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const tracks = data.tracks.items.filter(t => t.preview_url);

    if (!tracks.length) {
        console.log("No previews found, trying again...");
        return getRandomPreview();
    }

    const track = tracks[Math.floor(Math.random() * tracks.length)];
    console.log(`🎵 ${track.name} — ${track.artists[0].name}`);
    console.log(`Preview: ${track.preview_url}`);
}

getRandomPreview();
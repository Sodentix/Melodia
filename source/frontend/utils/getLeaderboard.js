export async function getLeaderboard(count = 5) {
  try {
    const res = await fetch(`https://randomuser.me/api/?results=${count}&nat=us`)
    const data = await res.json()

    const list = data.results.map((u, i) => ({
      rank: i + 1,
      player: u.login.username,
      score: Math.floor(1000 + Math.random() * 20000)
    }))

    list
      .sort((a, b) => b.score - a.score)
      .forEach((item, idx) => (item.rank = idx + 1))

    return list
  } catch (err) {
    console.error('Fehler beim Laden der Daten:', err)
    return []
  }
}

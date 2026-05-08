import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCw_JbTLEW4vfGDkF624dpCf5MMtyTYB7E",
    authDomain: "sleep-tracker-b2ffd.firebaseapp.com",
    projectId: "sleep-tracker-b2ffd",
    storageBucket: "sleep-tracker-b2ffd.firebasestorage.app",
    messagingSenderId: "904987298822",
    appId: "1:904987298822:web:ccd101593cf09032714787",
    measurementId: "G-BT13C46MWT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    let sleepLogs = [];

    const sleepForm = document.getElementById('sleep-form');
    const historyList = document.getElementById('history-list');
    const sleepChart = document.getElementById('sleep-chart');
    const clearBtn = document.getElementById('clear-data');
    const dateInput = document.getElementById('sleep-date');

    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

    async function loadLogs() {
        const user = auth.currentUser;
        if (!user) return;

        const snapshot = await getDocs(collection(db, "users", user.uid, "sleepLogs"));
        sleepLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        sleepLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderLogs();
        renderChart();
        renderAverage(sleepLogs);
    }

    function renderChart() {
        const ctx = sleepChart.getContext("2d");
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: sleepLogs.map(log => log.date),
                datasets: [
                    {
                        label: "睡眠時間",
                        data: sleepLogs.map(log => log.duration.totalMinutes),
                        backgroundColor: "#4f46e5",
                        borderColor: "#4f46e5",
                        yAxisID: "y"
                    },
                    {
                        label: "睡眠の質",
                        data: sleepLogs.map(log => log.quality),
                        backgroundColor: "#f59e0b",
                        borderColor: "#f59e0b",
                        yAxisID: "y2"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true, position: "left" },
                    y2: { beginAtZero: true, position: "right", min: 0, max: 5 }
                }
            }
        });
    }
    // ログインボタン
    document.getElementById('login-btn').addEventListener('click', async () => {
        await signInWithPopup(auth, provider);
    });

    // ログアウトボタン
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await signOut(auth);
    });

    // ログイン状態の監視
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // ログイン済み
            document.getElementById('login-btn').style.display = 'none';
            document.getElementById('user-info').style.display = 'block';
            document.getElementById('user-name').textContent = user.displayName;
            loadLogs();
        } else {
            // 未ログイン
            document.getElementById('login-btn').style.display = 'block';
            document.getElementById('user-info').style.display = 'none';
            sleepLogs = [];
            renderLogs();
        }
    });

    function renderAverage(logs) {
        if (logs.length === 0) return;
        const avgMinutes = Math.round(
            logs.reduce((sum, log) => sum + log.duration.totalMinutes, 0) / logs.length
        );
        const h = Math.floor(avgMinutes / 60);
        const m = avgMinutes % 60;
        document.getElementById("avg-duration").textContent = `${h}:${String(m).padStart(2, "0")}`;
        const avgQuality = (logs.reduce((sum, log) => sum + log.quality, 0) / logs.length).toFixed(1);
        document.getElementById("avg-quality").textContent = avgQuality;
        const avgTemp = (logs.reduce((sum, log) => sum + log.temperature, 0) / logs.length).toFixed(1);
        document.getElementById("avg-temp").textContent = `${avgTemp}℃`;
    }

    function filterLogs(range) {
        const now = new Date();
        if (range === "all") return sleepLogs;
        const days = range === "week" ? 7 : 30;
        return sleepLogs.filter(log => {
            const diff = (now - new Date(log.date)) / (1000 * 60 * 60 * 24);
            return diff <= days;
        });
    }

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const range = btn.dataset.range;
            renderAverage(filterLogs(range));
        });
    });

    async function saveLogs(log) {
        const user = auth.currentUser;
        if (!user) return;
        await addDoc(collection(db, "users", user.uid, "sleepLogs"), log);
    }

    function renderLogs() {
        if (sleepLogs.length === 0) {
            historyList.innerHTML = '<p class="empty-msg">まだ記録がありません。今日の睡眠を記録しましょう！</p>';
            return;
        }
        historyList.innerHTML = sleepLogs.map(log => {
            const emojis = ['😫', '😕', '😴', '😊', '🤩'];
            const qualityEmoji = emojis[log.quality - 1] || '😴';
            return `
                <div class="history-item">
                    <div class="item-info">
                        <h3>${log.date}</h3>
                        <p>${log.bedTime} 〜 ${log.wakeTime}${log.wakeTemp ? ` | 体温: ${log.wakeTemp}℃` : ''}</p>
                        ${log.habits && log.habits.length > 0 ? `
                            <div class="habit-tags">
                                ${log.habits.map(h => `<span class="habit-tag">${h}</span>`).join('')}
                            </div>` : ''}
                        ${log.notes ? `<div class="item-notes">${log.notes}</div>` : ''}
                    </div>
                    <div class="item-stats">
                        <div class="duration">${log.duration.hours}時間 ${log.duration.minutes}分</div>
                        <div class="quality-tag">${qualityEmoji}</div>
                    </div>
                    <button class="delete-btn" data-id="${log.id}">&times;</button>
                </div>`;
        }).join('');
    }

    function calculateDuration(bed, wake) {
        const [bedH, bedM] = bed.split(':').map(Number);
        const [wakeH, wakeM] = wake.split(':').map(Number);
        let bedDate = new Date(2000, 0, 1, bedH, bedM);
        let wakeDate = new Date(2000, 0, 1, wakeH, wakeM);
        if (wakeDate <= bedDate) wakeDate.setDate(wakeDate.getDate() + 1);
        const diffMs = wakeDate - bedDate;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return { hours: diffHrs, minutes: diffMins, totalMinutes: diffHrs * 60 + diffMins };
    }

    sleepForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('sleep-date').value;
        const bedTime = document.getElementById('bed-time').value;
        const wakeTime = document.getElementById('wake-time').value;
        const wakeTemp = document.getElementById('wake-temp').value;
        const quality = document.getElementById('sleep-quality').value;
        const notes = document.getElementById('sleep-notes').value;
        const habits = Array.from(document.querySelectorAll('input[name="habit"]:checked')).map(cb => cb.value);
        const duration = calculateDuration(bedTime, wakeTime);
        const newLog = {
            date, bedTime, wakeTime,
            wakeTemp: parseFloat(wakeTemp),
            quality: parseInt(quality),
            habits, notes, duration
        };
        await saveLogs(newLog);
        await loadLogs();
        sleepForm.reset();
        dateInput.value = today;
    });

    clearBtn.addEventListener('click', async () => {
        if (confirm('すべての記録を削除しますか？')) {
            const user = auth.currentUser;
            if (!user) return;
            const snapshot = await getDocs(collection(db, "users", auth.currentUser.uid, "sleepLogs"));
            await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, "users", auth.currentUser.uid, "sleepLogs", d.id))));
            sleepLogs = [];
            renderLogs();
            renderChart();
            renderAverage([]);
        }
    });

    historyList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.getAttribute('data-id');
            if (confirm('この記録を削除しますか？')) {
                const user = auth.currentUser;
                if (!user) return;
                await deleteDoc(doc(db, "users", auth.currentUser.uid, "sleepLogs", id));
                await loadLogs();
            }
        }
    });
});

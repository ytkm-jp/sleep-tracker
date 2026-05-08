document.addEventListener('DOMContentLoaded', () => {
    const sleepForm = document.getElementById('sleep-form');
    const historyList = document.getElementById('history-list');
    const sleepChart = document.getElementById('sleep-chart');
    const clearBtn = document.getElementById('clear-data');
    const dateInput = document.getElementById('sleep-date');

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

    // 記録を分析するチャートを表示する
function renderChart() {
    const ctx = sleepChart.getContext("2d");
    new Chart(ctx, {
        type: "line",
        data: {
            labels: sleepLogs.map(log => log.date),
            datasets: [
                {
                    label: "睡眠時間",
                    data: sleepLogs.map(log => log.duration.totalMinutes),
                    backgroundColor: "#4f46e5",
                    borderColor: "#4f46e5",
                    yAxisID: "y"       // ✅ "y"に修正
                },
                {
                    label: "睡眠の質",
                    data: sleepLogs.map(log => log.quality),
                    backgroundColor: "#f59e0b",  // ✅ 色を変える
                    borderColor: "#f59e0b",
                    yAxisID: "y2"
                }
            ]
        },
        options: {                     // ✅ dataの外に出す
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    position: "left"
                },
                y2: {
                    beginAtZero: true,
                    position: "right",
                    min: 0,
                    max: 5
                }
            }
        }
    });
}

//平均表示
function renderAverage(logs) {
    if (logs.length === 0) return;
    // 平均睡眠時間
    const avgMinutes = Math.round(
        logs.reduce((sum, log) => sum + log.duration.totalMinutes, 0) / logs.length
    );
    const h = Math.floor(avgMinutes / 60);
    const m = avgMinutes % 60;
    document.getElementById("avg-duration").textContent = 
        `${h}:${String(m).padStart(2, "0")}`;
    // 平均睡眠の質
    const avgQuality = (
        logs.reduce((sum, log) => sum + log.quality, 0) / logs.length
    ).toFixed(1);
    document.getElementById("avg-quality").textContent = avgQuality;
    // 平均起床時体温
    const avgTemp = (
        logs.reduce((sum, log) => sum + log.temperature, 0) / logs.length
    ).toFixed(1);
    document.getElementById("avg-temp").textContent = `${avgTemp}℃`;
    }
    
    // タブ切り替えのイベント
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        // activeクラスを切り替え
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // 範囲に応じてログを絞り込む
        const range = btn.dataset.range;
        const filteredLogs = filterLogs(range);
        renderAverages(filteredLogs);
    });
});

// ログを期間で絞り込む
function filterLogs(range) {
    const now = new Date();
    if (range === "all") return sleepLogs;

    const days = range === "week" ? 7 : 30;
    return sleepLogs.filter(log => {
        const diff = (now - new Date(log.date)) / (1000 * 60 * 60 * 24);
        return diff <= days;
    });
}
    // Initialize display
    renderLogs();
    renderChart();
    renderAverages();

    // Handle form submission
    sleepForm.addEventListener('submit', (e) => {
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
            id: Date.now(),
            date,
            bedTime,
            wakeTime,
            wakeTemp,
            quality,
            habits,
            notes,
            duration
        };

        sleepLogs.unshift(newLog);
        saveLogs();
        renderLogs();
        sleepForm.reset();
        dateInput.value = today; // Reset to today
    });

    // Clear data
    clearBtn.addEventListener('click', () => {
        if (confirm('すべての記録を削除しますか？')) {
            sleepLogs = [];
            saveLogs();
            renderLogs();
        }
    });

    // Handle individual delete
    historyList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            if (confirm('この記録を削除しますか？')) {
                sleepLogs = sleepLogs.filter(log => log.id !== id);
                saveLogs();
                renderLogs();
            }
        }
    });

    function calculateDuration(bed, wake) {
        const [bedH, bedM] = bed.split(':').map(Number);
        const [wakeH, wakeM] = wake.split(':').map(Number);

        let bedDate = new Date(2000, 0, 1, bedH, bedM);
        let wakeDate = new Date(2000, 0, 1, wakeH, wakeM);

        if (wakeDate <= bedDate) {
            wakeDate.setDate(wakeDate.getDate() + 1);
        }

        const diffMs = wakeDate - bedDate;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        return {
            hours: diffHrs,
            minutes: diffMins,
            totalMinutes: diffHrs * 60 + diffMins
        };
    }

    function saveLogs() {
        localStorage.setItem('sleepLogs', JSON.stringify(sleepLogs));
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
                            </div>
                        ` : ''}
                        ${log.notes ? `
                            <div class="item-notes">${log.notes}</div>
                        ` : ''}
                    </div>
                    <div class="item-stats">
                        <div class="duration">${log.duration.hours}時間 ${log.duration.minutes}分</div>
                        <div class="quality-tag">${qualityEmoji}</div>
                    </div>
                    <button class="delete-btn" data-id="${log.id}">&times;</button>
                </div>
            `;
        }).join('');
    }
});

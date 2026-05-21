import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, collectionGroup, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
let adminChartInstance = null;
let adminGenderCombinedChartInstance = null;
let allLogsForCSV = [];
const ADMIN_UID = "UHi5BIbO0jXYxNLQlDM70xTRwqh1";

const habitInfo = [
    { emoji: '☕', label: 'カフェイン控え' },
    { emoji: '🔦', label: 'ライト制限' },
    { emoji: '🛁', label: '入浴' },
    { emoji: '📱', label: 'スマホ控え' },
    { emoji: '📖', label: '読書' },
    { emoji: '🧘‍♂️', label: 'ストレッチ' }
];

document.addEventListener('DOMContentLoaded', () => {
    let sleepLogs = [];

    // リダイレクト後の結果を確認
    getRedirectResult(auth).catch((error) => {
        console.error("Redirect Result Error:", error);
        // エラーコードが auth/web-storage-unsupported の場合はCookie設定が原因
        if (error.code === 'auth/web-storage-unsupported') {
            alert("ブラウザのCookie設定によりログインできません。設定を確認してください。");
        }
    });

    const sleepForm = document.getElementById('sleep-form');
    const historyList = document.getElementById('history-list');
    const sleepChart = document.getElementById('sleep-chart');
    const clearBtn = document.getElementById('clear-data');
    const dateInput = document.getElementById('sleep-date');
    const loadSampleDataBtn = document.getElementById('load-sample-data');

    const sampleLogs = [
        { id: 'sample-1', date: '2026-05-12', bedTime: '23:20', wakeTime: '06:10', wakeTemp: 36.3, quality: 3, gender: 'female', habits: ['📖', '🛁'], notes: '読書と入浴で落ち着いた夜でした。', duration: { hours: 6, minutes: 50, totalMinutes: 410 } },
        { id: 'sample-2', date: '2026-05-13', bedTime: '00:15', wakeTime: '07:05', wakeTemp: 36.7, quality: 4, gender: 'female', habits: ['📱', '☕'], notes: 'スマホ控えを意識。', duration: { hours: 6, minutes: 50, totalMinutes: 410 } },
        { id: 'sample-3', date: '2026-05-14', bedTime: '23:45', wakeTime: '06:40', wakeTemp: 36.5, quality: 4, gender: 'female', habits: ['🔦'], notes: 'ライト制限が効いた感触。', duration: { hours: 6, minutes: 55, totalMinutes: 415 } },
        { id: 'sample-4', date: '2026-05-15', bedTime: '22:50', wakeTime: '06:30', wakeTemp: 36.6, quality: 5, gender: 'female', habits: ['🧘‍♂️', '📖'], notes: 'ストレッチと読書でゆったり。', duration: { hours: 7, minutes: 40, totalMinutes: 460 } },
        { id: 'sample-5', date: '2026-05-16', bedTime: '00:05', wakeTime: '06:55', wakeTemp: 36.2, quality: 3, gender: 'female', habits: ['📱'], notes: '夜更かししたので少し眠りが浅め。', duration: { hours: 6, minutes: 50, totalMinutes: 410 } },
        { id: 'sample-6', date: '2026-05-17', bedTime: '23:10', wakeTime: '06:20', wakeTemp: 36.4, quality: 4, gender: 'female', habits: ['☕', '📖'], notes: 'カフェイン少なめで良好。', duration: { hours: 7, minutes: 10, totalMinutes: 430 } },
        { id: 'sample-7', date: '2026-05-18', bedTime: '23:55', wakeTime: '07:00', wakeTemp: 36.8, quality: 5, gender: 'female', habits: ['🔦', '🛁'], notes: '入浴後の寝付きが良かった。', duration: { hours: 7, minutes: 5, totalMinutes: 425 } },
        { id: 'sample-8', date: '2026-05-19', bedTime: '22:40', wakeTime: '06:10', wakeTemp: 36.6, quality: 4, gender: 'female', habits: ['📖'], notes: '早めに布団に入った。', duration: { hours: 7, minutes: 30, totalMinutes: 450 } },
        { id: 'sample-9', date: '2026-05-20', bedTime: '23:25', wakeTime: '06:25', wakeTemp: 36.5, quality: 4, gender: 'female', habits: ['🧘‍♂️', '📖'], notes: '睡眠の質が安定。', duration: { hours: 7, minutes: 0, totalMinutes: 420 } },
        { id: 'sample-10', date: '2026-05-21', bedTime: '23:50', wakeTime: '07:00', wakeTemp: 36.7, quality: 5, gender: 'female', habits: ['🔦', '📖'], notes: '週末に向けて体調良好。', duration: { hours: 7, minutes: 10, totalMinutes: 430 } }
    ];

    // 深夜0〜4時は「就寝した日 = 前日」として扱う
    const now = new Date();
    const sleepDate = now.getHours() < 4
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        : now;
    // toISOString() はUTC基準なのでローカル時間で文字列化する
    const pad = n => String(n).padStart(2, '0');
    const today = `${sleepDate.getFullYear()}-${pad(sleepDate.getMonth() + 1)}-${pad(sleepDate.getDate())}`;
    dateInput.value = today;

    // 性別の初期値を localStorage から取得
    const genderSelect = document.getElementById('user-gender');
    if (genderSelect) {
        const savedGender = localStorage.getItem('sleepy_user_gender');
        if (savedGender) {
            genderSelect.value = savedGender;
        }
    }

    // フォームデータの自動保存と復元
    const FORM_STORAGE_KEY = 'sleepy_form_data';
    
    function saveFormData() {
        const formData = {
            bedTime: document.getElementById('bed-time').value,
            wakeTime: document.getElementById('wake-time').value,
            wakeTemp: document.getElementById('wake-temp').value,
            sleepQuality: document.getElementById('sleep-quality').value,
            sleepNotes: document.getElementById('sleep-notes').value,
            habits: Array.from(document.querySelectorAll('input[name="habit"]:checked')).map(cb => cb.value)
        };
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
    }

    function restoreFormData() {
        const saved = localStorage.getItem(FORM_STORAGE_KEY);
        if (!saved) return;
        
        try {
            const formData = JSON.parse(saved);
            if (formData.bedTime) document.getElementById('bed-time').value = formData.bedTime;
            if (formData.wakeTime) document.getElementById('wake-time').value = formData.wakeTime;
            if (formData.wakeTemp) document.getElementById('wake-temp').value = formData.wakeTemp;
            if (formData.sleepQuality) document.getElementById('sleep-quality').value = formData.sleepQuality;
            if (formData.sleepNotes) document.getElementById('sleep-notes').value = formData.sleepNotes;
            
            // 習慣チェックボックスの復元
            document.querySelectorAll('input[name="habit"]').forEach(cb => {
                cb.checked = formData.habits && formData.habits.includes(cb.value);
            });
        } catch (error) {
            console.error('Failed to restore form data:', error);
        }
    }

    // フォーム要素の変更時に自動保存
    const formElements = [
        'bed-time', 'wake-time', 'wake-temp', 'sleep-quality', 'sleep-notes'
    ];
    formElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', saveFormData);
    });
    
    document.querySelectorAll('input[name="habit"]').forEach(cb => {
        cb.addEventListener('change', saveFormData);
    });

    // ページ読み込み時にフォームデータを復元
    restoreFormData();

    async function loadLogs() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const snapshot = await getDocs(collection(db, "users", user.uid, "sleepLogs"));
            sleepLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            sleepLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // 1. まずはリストをすぐに表示（ユーザーへのレスポンス優先）
            renderLogs();
            
            // 2. 重い処理（グラフ描画と集計）は次の描画フレームに回す
            requestAnimationFrame(() => {
                // 初期表示は「全体」
                renderChart(sleepLogs);
                renderAverage(sleepLogs);
                renderHabitAnalysis(sleepLogs);
            });
        } catch (error) {
            console.error("Error loading logs:", error);
        }
    }

    function getWeekStartKey(dateString) {
        const date = new Date(dateString);
        const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const day = local.getDay();
        const diff = local.getDate() - day + (day === 0 ? -6 : 1);
        local.setDate(diff);
        return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
    }

    function renderChart(logs = sleepLogs) {
        const ctx = sleepChart.getContext("2d");
        if (chartInstance) chartInstance.destroy();

        // グラフ用に古い順に並び替え
        const displayLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));

        const weekBoundaries = [];
        for (let i = 1; i < displayLogs.length; i++) {
            if (getWeekStartKey(displayLogs[i].date) !== getWeekStartKey(displayLogs[i - 1].date)) {
                weekBoundaries.push(i);
            }
        }

        const weeklyBoundaryPlugin = {
            id: "weekly-boundary-lines",
            beforeDraw(chart) {
                const xScale = chart.scales.x;
                const yScale = chart.scales.y;
                if (!xScale || !yScale || weekBoundaries.length === 0) return;

                const ctx = chart.ctx;
                ctx.save();
                ctx.strokeStyle = "rgba(99, 102, 241, 0.55)";
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);

                weekBoundaries.forEach(index => {
                    const x = xScale.getPixelForTick(index);
                    ctx.beginPath();
                    ctx.moveTo(x, yScale.top);
                    ctx.lineTo(x, yScale.bottom);
                    ctx.stroke();
                });
                ctx.restore();
            }
        };

        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: displayLogs.map(log => log.date),
                datasets: [
                    {
                        label: "睡眠時間",
                        data: displayLogs.map(log => log.duration.totalMinutes),
                        backgroundColor: "#4f46e5",
                        borderColor: "#4f46e5",
                        yAxisID: "y"
                    },
                    {
                        label: "睡眠の質",
                        data: displayLogs.map(log => log.quality),
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
                    y: { 
                        beginAtZero: true, 
                        position: "left",
                        title: { display: true, text: '分' }
                    },
                    y2: { 
                        beginAtZero: true, 
                        position: "right", 
                        min: 0, 
                        max: 5,
                        title: { display: true, text: '質' },
                        grid: { drawOnChartArea: false }
                    }
                }
            },
            plugins: [weeklyBoundaryPlugin]
        });
    }
    // ログインボタン（PCでの確実性を優先してポップアップに戻す）
    document.getElementById('login-btn').addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login Error:", error);
            // COOPエラー等でポップアップが閉じない場合があるが、ログイン自体は成功することが多い
        }
    });

    // ログアウトボタン
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await signOut(auth);
    });

    // ログイン状態の監視
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (user.uid === ADMIN_UID) {
                const adminDash = document.getElementById('admin-dashboard');
                if (adminDash) {
                    adminDash.style.display = 'block';
                    // 履歴セクション（mainの中）の前に挿入して、分析結果として見やすくする
                    const main = document.querySelector('main');
                    const historySection = document.getElementById('history-section');
                    if (main && historySection) {
                        main.insertBefore(adminDash, historySection);
                    }
                    loadAdminData();
                }
            }
            console.log("Login detected:", user.displayName);
            document.getElementById('login-btn').style.display = 'none';
            const consentText = document.getElementById('login-consent-text');
            if (consentText) consentText.style.display = 'none';
            
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('user-name').textContent = user.displayName;
            
            const userPhoto = document.getElementById('user-photo');
            if (userPhoto) {
                // Googleの画像URLを取得、なければイニシャル画像
                const photoUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random&color=fff`;
                userPhoto.src = photoUrl;
                
                // 画像読み込みエラー時のフォールバック
                userPhoto.onerror = () => {
                    userPhoto.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=6366f1&color=fff`;
                };
            }
            loadLogs();
        } else {
            // 未ログイン
            document.getElementById('login-btn').style.display = 'block';
            const consentText = document.getElementById('login-consent-text');
            if (consentText) consentText.style.display = 'block';
            
            document.getElementById('user-info').style.display = 'none';
            sleepLogs = [];
            renderLogs();
        }
    });

    function renderAverage(logs) {
        if (logs.length === 0) {
            document.getElementById("avg-duration").textContent = "0:00";
            document.getElementById("avg-quality").textContent = "-";
            document.getElementById("avg-temp").textContent = "--℃";
            return;
        }
        const avgMinutes = Math.round(
            logs.reduce((sum, log) => sum + log.duration.totalMinutes, 0) / logs.length
        );
        const h = Math.floor(avgMinutes / 60);
        const m = avgMinutes % 60;
        document.getElementById("avg-duration").textContent = `${h}:${String(m).padStart(2, "0")}`;
        const avgQuality = (logs.reduce((sum, log) => sum + log.quality, 0) / logs.length).toFixed(1);
        document.getElementById("avg-quality").textContent = avgQuality;
        // 体温が記録されているデータのみを抽出
        const tempLogs = logs.filter(log => log.wakeTemp && !isNaN(log.wakeTemp));
        if (tempLogs.length > 0) {
            const avgTemp = (tempLogs.reduce((sum, log) => sum + log.wakeTemp, 0) / tempLogs.length).toFixed(1);
            document.getElementById("avg-temp").textContent = `${avgTemp}℃`;
        } else {
            document.getElementById("avg-temp").textContent = "--℃";
        }
    }

    function renderHabitAnalysis(logs) {
        const container = document.getElementById('habit-analysis-container');
        if (!container) return;

        // 分析には最低限のデータが必要
        if (logs.length < 3) {
            container.innerHTML = '<p class="empty-msg">十分なデータ（3件以上）が集まると、ここに習慣の分析結果が表示されます。</p>';
            return;
        }

        const results = habitInfo.map(habit => {
            const withHabit = logs.filter(l => l.habits && l.habits.includes(habit.emoji));
            const withoutHabit = logs.filter(l => !l.habits || !l.habits.includes(habit.emoji));

            // 両方のグループにデータがないと計算できない
            if (withHabit.length === 0 || withoutHabit.length === 0) return null;

            const avgWith = withHabit.reduce((sum, l) => sum + l.quality, 0) / withHabit.length;
            const avgWithout = withoutHabit.reduce((sum, l) => sum + l.quality, 0) / withoutHabit.length;
            const diff = avgWith - avgWithout;

            return { ...habit, avgWith, avgWithout, diff, count: withHabit.length };
        }).filter(r => r !== null);

        if (results.length === 0) {
            container.innerHTML = '<p class="empty-msg">習慣の有無による差を比較するには、同じ習慣を行ったり行わなかったりする記録が必要です。</p>';
            return;
        }

        // インパクト（絶対値）順にソート
        results.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

        container.innerHTML = results.map(r => `
            <div class="analysis-card">
                <div class="analysis-habit">
                    <div class="analysis-emoji">${r.emoji}</div>
                    <div class="analysis-label">${r.label}</div>
                </div>
                <div class="analysis-stats">
                    <div class="analysis-diff ${r.diff > 0 ? 'positive' : (r.diff < 0 ? 'negative' : '')}">
                        <span class="impact-label">影響</span>
                        ${r.diff > 0 ? '+' : ''}${r.diff.toFixed(1)}
                    </div>
                    <div class="analysis-details">
                        <div class="comparison-text">あり: ${r.avgWith.toFixed(1)}</div>
                        <div class="comparison-text">なし: ${r.avgWithout.toFixed(1)}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async function loadAdminData() {
        try {
            const allLogsQuery = query(collectionGroup(db, "sleepLogs"));
            const snapshot = await getDocs(allLogsQuery);
            // UIDをデータに含めて取得
            const allLogs = snapshot.docs.map(d => ({
                ...d.data(),
                uid: d.ref.parent.parent.id // ユーザー別の分析ができるようにUIDを付与
            }));
            allLogsForCSV = allLogs;
            
            // 参加人数（ユニークなユーザーID）をカウント
            const userIds = new Set(allLogs.map(log => log.uid));
            document.getElementById('admin-user-count').textContent = `参加人数: ${userIds.size}人`;
            
            if (allLogs.length > 0) {
                processAdminData(allLogs);
            }
        } catch (error) {
            console.error("Admin Data Load Error:", error);
            if (error.code === 'failed-precondition') {
                console.warn("Firestoreのインデックス作成が必要です。コンソールのリンクをクリックしてください。");
            }
        }
    }

    function processAdminData(allLogs) {
        // 外れ値を除外（3時間未満、または12時間以上のデータを取り除く）
        const filteredLogs = allLogs.filter(log => {
            const minutes = log.duration.totalMinutes;
            return minutes >= 180 && minutes <= 720;
        });

        // 日付ごとにグループ化して平均を出す
        const dailyAgg = {};
        filteredLogs.forEach(log => {
            if (!dailyAgg[log.date]) {
                dailyAgg[log.date] = { duration: 0, quality: 0, count: 0 };
            }
            dailyAgg[log.date].duration += log.duration.totalMinutes;
            dailyAgg[log.date].quality += log.quality;
            dailyAgg[log.date].count += 1;
        });

        const sortedDates = Object.keys(dailyAgg).sort();
        const avgDurations = sortedDates.map(d => Math.round(dailyAgg[d].duration / dailyAgg[d].count));
        const avgQualities = sortedDates.map(d => (dailyAgg[d].quality / dailyAgg[d].count).toFixed(1));

        // 全体平均の表示（フィルタリング後のデータを使用）
        const totalMinutes = filteredLogs.length > 0 
            ? Math.round(filteredLogs.reduce((s, l) => s + l.duration.totalMinutes, 0) / filteredLogs.length)
            : 0;
        const totalQuality = filteredLogs.length > 0 
            ? (filteredLogs.reduce((s, l) => s + l.quality, 0) / filteredLogs.length).toFixed(1)
            : "0.0";
        
        document.getElementById('admin-avg-duration').textContent = 
            `${Math.floor(totalMinutes/60)}:${String(totalMinutes%60).padStart(2, "0")}`;
        document.getElementById('admin-avg-quality').textContent = totalQuality;

        // 男女別の平均睡眠データ算出
        const maleLogs = filteredLogs.filter(l => l.gender === 'male');
        const femaleLogs = filteredLogs.filter(l => l.gender === 'female');

        const calculateStats = (logs) => {
            if (logs.length === 0) return { durationText: "0:00", qualityText: "-", countText: "0" };
            const avgMins = Math.round(logs.reduce((s, l) => s + l.duration.totalMinutes, 0) / logs.length);
            const avgQual = (logs.reduce((s, l) => s + l.quality, 0) / logs.length).toFixed(1);
            return {
                durationText: `${Math.floor(avgMins / 60)}:${String(avgMins % 60).padStart(2, "0")}`,
                qualityText: avgQual,
                countText: String(logs.length)
            };
        };

        const maleStats = calculateStats(maleLogs);
        const femaleStats = calculateStats(femaleLogs);

        const genderContainer = document.getElementById('admin-gender-analysis-container');
        if (genderContainer) {
            genderContainer.innerHTML = `
                <!-- 男子カード -->
                <div class="analysis-card" style="flex-direction: column; align-items: stretch; gap: 12px; padding: 1.25rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.5rem;">🙋‍♂️</span>
                        <span style="font-weight: 600; font-size: 1.1rem; color: #60a5fa;">男子の睡眠統計</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 0.75rem; color: var(--text-muted);">平均睡眠時間</div>
                            <div style="font-size: 1.2rem; font-weight: 600; color: white; margin-top: 4px;">${maleStats.durationText}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 0.75rem; color: var(--text-muted);">平均の質</div>
                            <div style="font-size: 1.2rem; font-weight: 600; color: #f59e0b; margin-top: 4px;">${maleStats.qualityText}</div>
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">データ数: ${maleStats.countText}件</div>
                </div>
                <!-- 女子カード -->
                <div class="analysis-card" style="flex-direction: column; align-items: stretch; gap: 12px; padding: 1.25rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.5rem;">🙋‍♀️</span>
                        <span style="font-weight: 600; font-size: 1.1rem; color: #f472b6;">女子の睡眠統計</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 0.75rem; color: var(--text-muted);">平均睡眠時間</div>
                            <div style="font-size: 1.2rem; font-weight: 600; color: white; margin-top: 4px;">${femaleStats.durationText}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 0.75rem; color: var(--text-muted);">平均の質</div>
                            <div style="font-size: 1.2rem; font-weight: 600; color: #f59e0b; margin-top: 4px;">${femaleStats.qualityText}</div>
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">データ数: ${femaleStats.countText}件</div>
                </div>
            `;
        }

        // 男女別の日別集計
        const dailyMaleAgg = {};
        const dailyFemaleAgg = {};

        sortedDates.forEach(date => {
            dailyMaleAgg[date] = { duration: 0, quality: 0, count: 0 };
            dailyFemaleAgg[date] = { duration: 0, quality: 0, count: 0 };
        });

        maleLogs.forEach(log => {
            if (!dailyMaleAgg[log.date]) {
                dailyMaleAgg[log.date] = { duration: 0, quality: 0, count: 0 };
            }
            dailyMaleAgg[log.date].duration += log.duration.totalMinutes;
            dailyMaleAgg[log.date].quality += log.quality;
            dailyMaleAgg[log.date].count += 1;
        });

        femaleLogs.forEach(log => {
            if (!dailyFemaleAgg[log.date]) {
                dailyFemaleAgg[log.date] = { duration: 0, quality: 0, count: 0 };
            }
            dailyFemaleAgg[log.date].duration += log.duration.totalMinutes;
            dailyFemaleAgg[log.date].quality += log.quality;
            dailyFemaleAgg[log.date].count += 1;
        });

        const maleDurations = sortedDates.map(d => dailyMaleAgg[d].count > 0 ? Math.round(dailyMaleAgg[d].duration / dailyMaleAgg[d].count) : null);
        const maleQualities = sortedDates.map(d => dailyMaleAgg[d].count > 0 ? parseFloat((dailyMaleAgg[d].quality / dailyMaleAgg[d].count).toFixed(1)) : null);
        
        const femaleDurations = sortedDates.map(d => dailyFemaleAgg[d].count > 0 ? Math.round(dailyFemaleAgg[d].duration / dailyFemaleAgg[d].count) : null);
        const femaleQualities = sortedDates.map(d => dailyFemaleAgg[d].count > 0 ? parseFloat((dailyFemaleAgg[d].quality / dailyFemaleAgg[d].count).toFixed(1)) : null);

        renderAdminChart(sortedDates, avgDurations, avgQualities);
        renderAdminGenderCharts(sortedDates, maleDurations, femaleDurations, maleQualities, femaleQualities);
        renderAdminHabitAnalysis(filteredLogs);
    }

    function renderAdminChart(labels, durations, qualities) {
        const ctx = document.getElementById('admin-all-chart').getContext('2d');
        if (adminChartInstance) adminChartInstance.destroy();
        adminChartInstance = new Chart(ctx, {
            type: "bar", // 全体はバーチャートの方が見やすい場合がある
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "全体平均睡眠時間 (分)",
                        data: durations,
                        backgroundColor: "rgba(99, 102, 241, 0.5)",
                        borderColor: "#6366f1",
                        borderWidth: 1,
                        yAxisID: "y"
                    },
                    {
                        label: "全体平均の質",
                        data: qualities,
                        type: "line",
                        borderColor: "#f59e0b",
                        backgroundColor: "#f59e0b",
                        yAxisID: "y2"
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, position: "left", title: { display: true, text: '分' } },
                    y2: { beginAtZero: true, position: "right", min: 0, max: 5, title: { display: true, text: '質' } }
                }
            }
        });
    }

    function renderAdminGenderCharts(labels, maleDurations, femaleDurations, maleQualities, femaleQualities) {
        const ctx = document.getElementById('admin-gender-combined-chart').getContext('2d');
        if (adminGenderCombinedChartInstance) adminGenderCombinedChartInstance.destroy();
        adminGenderCombinedChartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "男子の平均睡眠時間 (分)",
                        data: maleDurations,
                        borderColor: "#60a5fa",
                        backgroundColor: "#60a5fa",
                        spanGaps: true,
                        yAxisID: "y"
                    },
                    {
                        label: "女子の平均睡眠時間 (分)",
                        data: femaleDurations,
                        borderColor: "#f472b6",
                        backgroundColor: "#f472b6",
                        spanGaps: true,
                        yAxisID: "y"
                    },
                    {
                        label: "男子の平均の質",
                        data: maleQualities,
                        borderColor: "#3b82f6", // 濃い青
                        backgroundColor: "#3b82f6",
                        borderDash: [5, 5],
                        spanGaps: true,
                        yAxisID: "y2"
                    },
                    {
                        label: "女子の平均の質",
                        data: femaleQualities,
                        borderColor: "#ec4899", // 濃いピンク
                        backgroundColor: "#ec4899",
                        borderDash: [5, 5],
                        spanGaps: true,
                        yAxisID: "y2"
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        position: "left",
                        title: { display: true, text: '分' }
                    },
                    y2: { 
                        beginAtZero: true, 
                        position: "right",
                        min: 0, 
                        max: 5,
                        title: { display: true, text: '質' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }
    // 全体集計の習慣分析
    function renderAdminHabitAnalysis(logs) {
        const container = document.getElementById('admin-habit-analysis-container');
        if (!container) return;

        // 分析には最低限のデータが必要
        if (logs.length < 3) {
            container.innerHTML = '<p class="empty-msg">十分なデータ（3件以上）が集まると、ここに全体の習慣の分析結果が表示されます。</p>';
            return;
        }

        const results = habitInfo.map(habit => {
            const withHabit = logs.filter(l => l.habits && l.habits.includes(habit.emoji));
            const withoutHabit = logs.filter(l => !l.habits || !l.habits.includes(habit.emoji));

            // 両方のグループにデータがないと計算できない
            if (withHabit.length === 0 || withoutHabit.length === 0) return null;

            const avgWith = withHabit.reduce((sum, l) => sum + l.quality, 0) / withHabit.length;
            const avgWithout = withoutHabit.reduce((sum, l) => sum + l.quality, 0) / withoutHabit.length;
            const diff = avgWith - avgWithout;

            return { ...habit, avgWith, avgWithout, diff, count: withHabit.length };
        }).filter(r => r !== null);

        if (results.length === 0) {
            container.innerHTML = '<p class="empty-msg">習慣の有無による差を比較するには、全体で同じ習慣を行ったり行わなかったりする記録が必要です。</p>';
            return;
        }

        // インパクト（絶対値）順にソート
        results.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

        container.innerHTML = results.map(r => `
            <div class="analysis-card">
                <div class="analysis-habit">
                    <div class="analysis-emoji">${r.emoji}</div>
                    <div class="analysis-label">${r.label}</div>
                </div>
                <div class="analysis-stats">
                    <div class="analysis-diff ${r.diff > 0 ? 'positive' : (r.diff < 0 ? 'negative' : '')}">
                        <span class="impact-label">影響</span>
                        ${r.diff > 0 ? '+' : ''}${r.diff.toFixed(1)}
                    </div>
                    <div class="analysis-details">
                        <div class="comparison-text">あり: ${r.avgWith.toFixed(1)}</div>
                        <div class="comparison-text">なし: ${r.avgWithout.toFixed(1)}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // CSVダウンロード機能
    const csvBtn = document.getElementById('admin-download-csv');
    if (csvBtn) {
        csvBtn.addEventListener('click', () => {
            if (allLogsForCSV.length === 0) {
                alert("ダウンロードするデータがありません。");
                return;
            }

            // ヘッダー（項目名）
            const headers = ["ユーザーID", "日付", "就寝時間", "起床時間", "睡眠時間(分)", "睡眠の質", "体温", "性別", "習慣", "メモ"];
            
            // データ行の作成
            const rows = allLogsForCSV.map(log => [
                log.uid,
                log.date,
                log.bedTime,
                log.wakeTime,
                log.duration.totalMinutes,
                log.quality,
                log.wakeTemp || "",
                log.gender === 'male' ? '男性' : (log.gender === 'female' ? '女性' : (log.gender === 'other' ? 'その他・未回答' : '未設定')),
                (log.habits || []).join(" "),
                (log.notes || "").replace(/\n/g, " ") // 改行をスペースに置換
            ]);

            // カンマ区切りのテキストを作成
            const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");

            // BOM（Excelの文字化け対策）を付与してBlob作成
            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8" });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const _d = new Date();
            const localDate = `${_d.getFullYear()}-${pad(_d.getMonth() + 1)}-${pad(_d.getDate())}`;
            a.download = `sleep_data_all_${localDate}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
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

    // 統計用タブ
    document.querySelectorAll("#average-stats .tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#average-stats .tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const range = btn.dataset.range;
            renderAverage(filterLogs(range));
        });
    });

    // グラフ用タブ
    document.querySelectorAll(".chart-tabs .tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".chart-tabs .tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const range = btn.dataset.range;
            renderChart(filterLogs(range));
        });
    });

    if (loadSampleDataBtn) {
        loadSampleDataBtn.addEventListener('click', () => {
            sleepLogs = [...sampleLogs];
            renderLogs();
            renderChart(sleepLogs);
            renderAverage(sleepLogs);
            renderHabitAnalysis(sleepLogs);
        });
    }

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

        // 同じ日付のログが既に存在する場合は保存不可
        const duplicate = sleepLogs.find(log => log.date === date);
        if (duplicate) {
            alert(`${date} の記録はすでに存在します。\n上書きしたい場合は、先にその日の記録を削除してください。`);
            return;
        }

        const bedTime = document.getElementById('bed-time').value;
        const wakeTime = document.getElementById('wake-time').value;
        const wakeTemp = document.getElementById('wake-temp').value;
        const quality = document.getElementById('sleep-quality').value;
        const notes = document.getElementById('sleep-notes').value;
        const habits = Array.from(document.querySelectorAll('input[name="habit"]:checked')).map(cb => cb.value);
        const duration = calculateDuration(bedTime, wakeTime);
        const gender = document.getElementById('user-gender').value;

        // 性別を localStorage に保存
        if (gender) {
            localStorage.setItem('sleepy_user_gender', gender);
        } else {
            localStorage.removeItem('sleepy_user_gender');
        }

        const newLog = {
            date, bedTime, wakeTime,
            wakeTemp: parseFloat(wakeTemp),
            quality: parseInt(quality),
            gender: gender || "",
            habits, notes, duration
        };
        await saveLogs(newLog);
        await loadLogs();
        renderHabitAnalysis(sleepLogs);
        
        // フォームのリセットと初期値の再設定
        sleepForm.reset();
        dateInput.value = today;
        if (genderSelect && gender) {
            genderSelect.value = gender; // リセット後も記憶した性別を再選択状態に
        }
        
        // 保存したフォームデータをクリア
        localStorage.removeItem(FORM_STORAGE_KEY);
    });

    // 全消去ボタンの共通処理
    async function clearAllLogs() {
        if (confirm('すべての記録を削除しますか？（この操作は取り消せません）')) {
            const user = auth.currentUser;
            if (!user) return;
            const snapshot = await getDocs(collection(db, "users", auth.currentUser.uid, "sleepLogs"));
            await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, "users", auth.currentUser.uid, "sleepLogs", d.id))));
            sleepLogs = [];
            renderLogs();
            renderChart(sleepLogs);
            renderAverage([]);
            renderHabitAnalysis([]);
        }
    }

    clearBtn.addEventListener('click', clearAllLogs);
    const resetStatsBtn = document.getElementById('reset-stats');
    if (resetStatsBtn) {
        resetStatsBtn.addEventListener('click', clearAllLogs);
    }

    historyList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.getAttribute('data-id');
            if (confirm('この記録を削除しますか？')) {
                const user = auth.currentUser;
                if (!user) return;
                await deleteDoc(doc(db, "users", auth.currentUser.uid, "sleepLogs", id));
                await loadLogs();
                renderHabitAnalysis(sleepLogs);
            }
        }
    });

    // 個人データのCSVダウンロード
    const downloadMyCsvBtn = document.getElementById('download-my-csv');
    if (downloadMyCsvBtn) {
        downloadMyCsvBtn.addEventListener('click', () => {
            if (sleepLogs.length === 0) {
                alert('ダウンロードするデータがありません。');
                return;
            }

            const headers = ['日付', '就寝時間', '起床時間', '睡眠時間(分)', '睡眠の質', '体温', '性別', '習慣', 'メモ'];
            const rows = sleepLogs.map(log => [
                log.date,
                log.bedTime,
                log.wakeTime,
                log.duration.totalMinutes,
                log.quality,
                log.wakeTemp || '',
                log.gender === 'male' ? '男性' : (log.gender === 'female' ? '女性' : (log.gender === 'other' ? 'その他・未回答' : '未設定')),
                (log.habits || []).join(' '),
                (log.notes || '').replace(/\n/g, ' ')
            ]);

            const csvContent = [headers, ...rows]
                .map(r => r.map(v => `"${v}"`).join(','))
                .join('\n');

            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const _d = new Date();
            const localDate = `${_d.getFullYear()}-${pad(_d.getMonth() + 1)}-${pad(_d.getDate())}`;
            a.download = `my_sleep_data_${localDate}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
});

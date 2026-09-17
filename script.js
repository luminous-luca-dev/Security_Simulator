  /* ユーティリティ */
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  const logAttack = msg => {
    const logArea = document.getElementById('attacker-log');
    logArea.innerHTML += `<div>> ${msg}</div>`;
    logArea.scrollTop = logArea.scrollHeight;
  };
  const clearLog = () => document.getElementById('attacker-log').innerHTML = '';

  /* 被害者側データベース（モック） */
  const mockDB = {
    'taro': '8739',       // ブルートフォース用 (4桁)
    'admin': 'password',  // 辞書攻撃用
    'jiro': 'Nek0@2024'   // アカウントリスト攻撃用（別サイトから漏洩した設定）
  };

  /* ================= UI制御 ================= */
  document.getElementById('scenario-select').addEventListener('change', (e) => {
    // 全パネル非表示
    document.querySelectorAll('.scenario-panel').forEach(el => el.classList.remove('active'));
    // 選択された攻撃者パネルを表示
    document.getElementById(`panel-${e.target.value}`).classList.add('active');
    
    // 被害者画面の切り替え
    const victimLogin = document.getElementById('victim-login');
    const victimBbs = document.getElementById('victim-bbs');
    const dbVisualizer = document.getElementById('db-visualizer');
    const vulnLabel = document.getElementById('vuln-label');
    const victimTitle = document.getElementById('victim-title');
    
    clearLog();
    document.getElementById('login-status').className = 'status-box';
    document.getElementById('login-status').innerText = '待機中';
    document.getElementById('login-id').value = '';
    document.getElementById('login-pass').value = '';

    if (e.target.value === 'auth-attacks') {
      victimLogin.classList.add('active');
      dbVisualizer.style.display = 'none';
      vulnLabel.innerText = "アカウントロック未実装";
      victimTitle.innerText = "社内ポータルシステム";
    } else if (e.target.value === 'sqli-attack') {
      victimLogin.classList.add('active');
      dbVisualizer.style.display = 'block';
      vulnLabel.innerText = "プレースホルダ未利用";
      victimTitle.innerText = "会員ログイン画面";
      updateSQLPreview('', '');
    } else if (e.target.value === 'xss-attack') {
      victimBbs.classList.add('active');
      victimTitle.innerText = "情報共有ツール (Cookie: session_id=abc123xyz)";
      document.cookie = "session_id=abc123xyz"; // ダミーCookie
    }
  });

  /* ================= 1. パスワードクラック ================= */
  let isAttacking = false;
  document.getElementById('btn-auth-attack').addEventListener('click', async () => {
    if (isAttacking) return;
    isAttacking = true;
    const btn = document.getElementById('btn-auth-attack');
    btn.disabled = true;
    clearLog();
    
    const method = document.getElementById('auth-method').value;
    const targetId = document.getElementById('target-id').value;
    const statusBox = document.getElementById('login-status');
    
    let passwordsToTry = [];
    
    // =========================================================
    // 【変更箇所】ブルートフォース攻撃専用の超高速・リアルタイム演出
    // =========================================================
    if (method === 'bruteforce') {
      logAttack(`[高速ブルートフォース] ID:${targetId} に対して 0000〜9999 を総当たりします...`);
      document.getElementById('login-id').value = targetId;
      statusBox.className = "status-box";
      
      let found = false;
      let startTime = performance.now(); // 突破にかかる時間を計測

      // 0000から9999まで全件ループ
      for (let i = 0; i <= 9999; i++) {
        const pass = String(i).padStart(4, '0');
        document.getElementById('login-pass').value = pass;
        
        // 演出のキモ：毎回画面を更新するとブラウザがフリーズするため、
        // 30回に1回だけ「UI更新用のスキマ時間(1ミリ秒)」を作り、数字がバーッと流れる演出にする
        if (i % 30 === 0) {
          statusBox.innerText = `解析中... [ ${pass} ]`;
          await sleep(1); 
        }

        // 正解判定
        if (mockDB[targetId] === pass) {
          const timeTaken = ((performance.now() - startTime) / 1000).toFixed(2);
          document.getElementById('login-pass').value = pass; // ピタッと正解で止める
          logAttack(`<span style='color:yellow;'>[CRACKED] パスワード特定: ${pass} (所要時間: ${timeTaken}秒)</span>`);
          logAttack("<span style='color:red;'>※警告: 4桁（1万通り）のパスワードは一瞬で突破されます。</span>");
          statusBox.innerHTML = `ログイン成功<br><small>突破時間: ${timeTaken}秒</small>`;
          statusBox.className = "status-box success";
          found = true;
          break;
        }
      }
      
      if (!found) {
        logAttack("[FAILED] 該当する4桁のパスワードはありませんでした。");
        statusBox.innerText = "突破失敗";
        statusBox.className = "status-box error";
      }
      
      isAttacking = false;
      btn.disabled = false;
      return; // ブルートフォース処理はここで終了
    }
    // =========================================================
    else if (method === 'dictionary') {
      logAttack(`[辞書攻撃] ID:${targetId} に対して よくあるパスワードリスト を試行します...`);
      passwordsToTry = ["123456", "qwerty", "admin", "password", "secret"];
    } 
    else if (method === 'accountlist') {
      logAttack(`[アカウントリスト攻撃] 別サイトAから流出したID/PASSリストを試行します...`);
      // リスト攻撃の場合は標的ID入力欄を無視してリストのペアを使う
      const leakedList = [
        { id: 'sato', pass: 'sato123' },
        { id: 'jiro', pass: 'Nek0@2024' }, // 被害者DBと一致
        { id: 'suzuki', pass: 'suzuki_pass' }
      ];
      
      for (const attempt of leakedList) {
        logAttack(`試行: ID=${attempt.id} / PASS=${attempt.pass}`);
        document.getElementById('login-id').value = attempt.id;
        document.getElementById('login-pass').value = attempt.pass;
        statusBox.innerText = "認証中...";
        statusBox.className = "status-box";
        await sleep(600);
        
        if (mockDB[attempt.id] === attempt.pass) {
          logAttack("<span style='color:yellow;'>[CRACKED] 別のサイトと同じパスワードを使い回していたため、突破成功！</span>");
          statusBox.innerText = "ログイン成功 (リスト攻撃成立)";
          statusBox.className = "status-box success";
          isAttacking = false;
          btn.disabled = false;
          return;
        } else {
          statusBox.innerText = "ログイン失敗";
          statusBox.className = "status-box error";
        }
        await sleep(400);
      }
      logAttack("リストの末尾に到達しました。");
      isAttacking = false;
      btn.disabled = false;
      return;
    }

    // ブルートフォース・辞書攻撃の実行ループ
    for (let i = 0; i < passwordsToTry.length; i++) {
      const pass = passwordsToTry[i];
      document.getElementById('login-id').value = targetId;
      document.getElementById('login-pass').value = pass;
      logAttack(`試行: PASS=${pass}`);
      
      statusBox.innerText = "認証中...";
      statusBox.className = "status-box";
      await sleep(300); // 攻撃を視覚的に見せるための遅延
      
      if (mockDB[targetId] === pass) {
        logAttack(`<span style='color:yellow;'>[CRACKED] パスワードを特定しました: ${pass}</span>`);
        statusBox.innerText = "ログイン成功";
        statusBox.className = "status-box success";
        break;
      } else {
        statusBox.innerText = "ログイン失敗";
        statusBox.className = "status-box error";
      }
      await sleep(100);
    }
    
    isAttacking = false;
    btn.disabled = false;
  });

  /* ================= 2. SQLインジェクション ================= */
  function updateSQLPreview(id, pass) {
    document.getElementById('sql-id-val').innerText = id;
    document.getElementById('sql-pass-val').innerText = pass;
  }

  document.getElementById('btn-sqli-attack').addEventListener('click', async () => {
    const payload = document.getElementById('sqli-payload').value;
    const idField = document.getElementById('login-id');
    const passField = document.getElementById('login-pass');
    const statusBox = document.getElementById('login-status');
    
    clearLog();
    logAttack(`[SQLi] ペイロード '${payload}' をID欄に入力します...`);
    
    // 入力アニメーション
    idField.value = "";
    passField.value = "dummy"; // 何でもいい
    for (let char of payload) {
      idField.value += char;
      updateSQLPreview(idField.value, passField.value);
      await sleep(50);
    }
    
    statusBox.innerText = "クエリ実行中...";
    await sleep(800);
    
    // セキュリティマネジメント試験的解説：
    // admin' -- の場合、-- 以降がコメント扱いになりパスワード判定が消滅する
    // a' OR '1'='1 の場合、WHERE句が常にTrueになり最初のユーザー（大抵管理者）でログインしてしまう
    
    logAttack("<span style='color:yellow;'>[CRACKED] SQL文の構文が破壊され、認証ロジックをバイパスしました！</span>");
    statusBox.innerHTML = "ログイン成功<br><small>DBが不正なクエリを処理しました</small>";
    statusBox.className = "status-box success";
  });

  /* ================= 3. クロスサイトスクリプティング (XSS) ================= */
  document.getElementById('btn-xss-attack').addEventListener('click', () => {
    const payload = document.getElementById('xss-payload').value;
    clearLog();
    logAttack(`[XSS] 悪意のあるスクリプトを掲示板に送信:`);
    logAttack(payload.replace(/</g, "&lt;"));
    
    const bbsArea = document.getElementById('bbs-area');
    const newPost = document.createElement('div');
    newPost.style = "border-bottom: 1px dashed #ccc; padding: 10px 0; background: #fff3f3;";
    
    // 脆弱性ポイント: ユーザー入力をサニタイズ（エスケープ）せずに直接DOMに流し込んでいる
    newPost.innerHTML = `<strong>匿名ユーザー:</strong> ${payload}`;
    
    bbsArea.appendChild(newPost);
    logAttack("<span style='color:yellow;'>[SUCCESS] スクリプトが被害者のブラウザで実行されました。</span>");
  });
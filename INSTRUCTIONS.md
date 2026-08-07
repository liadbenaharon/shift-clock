# הסבר איך להעלות ל-GitHub Pages

## מה זה GitHub Pages?
GitHub Pages הוא שירות חינמית של GitHub שמאפשרת להעלות קבצים סטטיים (HTML, CSS, JS) לאינטרנט.

## איך להעלות את הקבצים:

### שלב 1: צור Repository חדש ב-GitHub
1. היכנס ל-GitHub.com
2. לחץ על "New repository"
3. תן שם ל-repository (למשל: shift-clock)
4. בחר "Public" (חשוב להיות public כדי שהקישור יעבוד)
5. לחץ על "Create repository"

### שלב 2: העלה את הקבצים
**אפשרות A: דרך האתר (למתחילים)**
1. ב-repository החדש, לחץ על "Add file" → "Upload files"
2. גרור את הקבצים הבאים:
   - shift-clock.html
   - manifest.json
   - service-worker.js
3. לחץ על "Commit changes"

**אפשרות B: דרך Git (למתקדמים)**
```bash
git init
git add shift-clock.html manifest.json service-worker.js
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/shift-clock.git
git push -u origin main
```

### שלב 3: הפעל GitHub Pages
1. ב-repository, לחץ על "Settings"
2. בתפריט השמאלי, לחץ על "Pages"
3. תחת "Source", בחר "Deploy from a branch"
4. בחר "main" ובחר "/ (root)"
5. לחץ על "Save"

### שלב 4: חכה לפריסה
1. תחכה כ-1-2 דקות
2. GitHub יפרסם את האתר
3. תקבל את הקישור: `https://YOUR_USERNAME.github.io/shift-clock/`

### שלב 5: התקנה כאפליקציה
1. פתח את הקישור בטלפון או מחשב
2. ב-Chrome: לחץ על התפריט השלוש נקודות (⋮) → "Add to Home screen"
3. ב-Safari: לחץ על "Share" → "Add to Home Screen"
4. תקבל את האפליקציה על המסך שלך

## יתרונות השיטה הזו:
- ✅ חינם לגמרי
- ✅ עובד ללא אינטרנט (offline)
- ✅ תזכורות עובדות כשהאפליקציה פתוחה
- ✅ תמיכה במכשירים רבים
- ✅ קל לשימוש ולתחזוק

## חשוב לדעת:
- כל הקבצים צריכים להיות בתיקייה הראשית (/)
- ה-service-worker יפעל רק אם האתר מופעל דרך HTTPS
- תזכורות עובדות רק כשהאפליקציה פתוחה ברקע
- לאחר כל שינוי בקבצים, צריך לעדכן את ה-repository

## טיפים:
- אם יש שינויים בקבצים, לחץ על "Sync" ב-GitHub Desktop
- אם ה-service-worker לא עובד, בדוק שהקבצים בתיקייה הראשית
- אם יש בעיות, נסה לנקות את ה-cache בדפדפן

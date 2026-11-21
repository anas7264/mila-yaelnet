
(function () {
  "use strict";
  const GROUPS = [{"id":"general","title":"مصطلحات أكاديمية عامة","terms":[{"id":"academic-001","he":"מושג","ar":"مفهوم","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-002","he":"הגדרה","ar":"تعريف","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-003","he":"תהליך","ar":"عملية","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-004","he":"תוצאה","ar":"نتيجة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-005","he":"מטרה","ar":"هدف","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-006","he":"שיטה","ar":"طريقة / منهج","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-007","he":"דוגמה","ar":"مثال","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-008","he":"הסבר","ar":"شرح","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-009","he":"הוכחה","ar":"برهان / إثبات","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-010","he":"פתרון","ar":"حل","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-011","he":"בעיה","ar":"مشكلة / مسألة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-012","he":"שאלה","ar":"سؤال","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-013","he":"תשובה","ar":"إجابة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-014","he":"תרגיל","ar":"تمرين","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-015","he":"משימה","ar":"مهمة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-016","he":"מבחן","ar":"امتحان","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-017","he":"בחינה","ar":"اختبار / امتحان","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-018","he":"ציון","ar":"علامة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-019","he":"דרישה","ar":"متطلب","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-020","he":"תנאי","ar":"شرط","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-021","he":"חובה","ar":"إلزام / واجب","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-022","he":"רשות","ar":"اختياري / صلاحية","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-023","he":"הרצאה","ar":"محاضرة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-024","he":"מעבדה","ar":"مختبر","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-025","he":"ניסוי","ar":"تجربة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-026","he":"מחקר","ar":"بحث","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-027","he":"נתונים","ar":"معطيات / بيانات","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-028","he":"מקור","ar":"مصدر","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-029","he":"מסקנה","ar":"استنتاج","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-030","he":"השוואה","ar":"مقارنة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-031","he":"הבדל","ar":"اختلاف","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-032","he":"דמיון","ar":"تشابه","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-033","he":"יתרון","ar":"ميزة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-034","he":"חיסרון","ar":"عيب / نقطة ضعف","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-035","he":"השפעה","ar":"تأثير","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-036","he":"גורם","ar":"عامل / سبب","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-037","he":"שלב","ar":"مرحلة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-038","he":"רמה","ar":"مستوى","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-039","he":"תחום","ar":"مجال","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-040","he":"יכולת","ar":"قدرة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-041","he":"מיומנות","ar":"مهارة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-042","he":"ידע","ar":"معرفة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-043","he":"הבנה","ar":"فهم","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-044","he":"זיכרון","ar":"ذاكرة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-045","he":"תרגול","ar":"ممارسة / تدريب","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-046","he":"שיפור","ar":"تحسين","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-047","he":"התקדמות","ar":"تقدّم","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-048","he":"הצלחה","ar":"نجاح","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-049","he":"כישלון","ar":"فشل","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-050","he":"דיוק","ar":"دقة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-051","he":"טעות","ar":"خطأ","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-052","he":"תיקון","ar":"تصحيح","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-053","he":"הערכה","ar":"تقييم","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-054","he":"משוב","ar":"ملاحظات / تغذية راجعة","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-055","he":"לוח זמנים","ar":"جدول زمني","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-056","he":"מועד","ar":"موعد","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-057","he":"הרשמה","ar":"تسجيل","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-058","he":"קבלה","ar":"قبول","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-059","he":"תואר","ar":"درجة جامعية","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-060","he":"פקולטה","ar":"كلية","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-061","he":"מחלקה","ar":"قسم","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-062","he":"קורס","ar":"مساق","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-063","he":"נקודות זכות","ar":"ساعات / نقاط أكاديمية","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-064","he":"סמסטר","ar":"فصل دراسي","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"},{"id":"academic-065","he":"שנה אקדמית","ar":"سنة أكاديمية","groupId":"general","groupTitle":"مصطلحات أكاديمية عامة"}]},{"id":"math-physics","title":"الرياضيات والفيزياء","terms":[{"id":"academic-066","he":"משוואה","ar":"معادلة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-067","he":"נעלם","ar":"مجهول","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-068","he":"משתנה","ar":"متغيّر","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-069","he":"קבוע","ar":"ثابت","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-070","he":"פונקציה","ar":"دالة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-071","he":"גרף","ar":"رسم بياني","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-072","he":"ציר","ar":"محور","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-073","he":"שיפוע","ar":"ميل","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-074","he":"נקודת חיתוך","ar":"نقطة تقاطع","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-075","he":"תחום הגדרה","ar":"مجال التعريف","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-076","he":"ערך","ar":"قيمة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-077","he":"ביטוי","ar":"تعبير رياضي","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-078","he":"שבר","ar":"كسر","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-079","he":"מכנה","ar":"مقام","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-080","he":"מונה","ar":"بسط","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-081","he":"חזקה","ar":"أسّ","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-082","he":"שורש","ar":"جذر","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-083","he":"לוגריתם","ar":"لوغاريتم","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-084","he":"נגזרת","ar":"مشتقة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-085","he":"אינטגרל","ar":"تكامل","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-086","he":"גבול","ar":"نهاية رياضية","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-087","he":"רציפות","ar":"استمرارية","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-088","he":"קיצון","ar":"قيمة قصوى / صغرى","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-089","he":"מקסימום","ar":"قيمة عظمى","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-090","he":"מינימום","ar":"قيمة صغرى","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-091","he":"סדרה","ar":"متتالية","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-092","he":"טור","ar":"متسلسلة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-093","he":"מטריצה","ar":"مصفوفة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-094","he":"וקטור","ar":"متجه","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-095","he":"גודל","ar":"مقدار","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-096","he":"כיוון","ar":"اتجاه","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-097","he":"זווית","ar":"زاوية","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-098","he":"מרחק","ar":"مسافة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-099","he":"מהירות","ar":"سرعة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-100","he":"תאוצה","ar":"تسارع","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-101","he":"זמן","ar":"زمن","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-102","he":"מיקום","ar":"موضع","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-103","he":"תנועה","ar":"حركة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-104","he":"כוח","ar":"قوة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-105","he":"מסה","ar":"كتلة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-106","he":"משקל","ar":"وزن","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-107","he":"אנרגיה","ar":"طاقة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-108","he":"עבודה","ar":"شغل","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-109","he":"הספק","ar":"قدرة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-110","he":"לחץ","ar":"ضغط","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-111","he":"צפיפות","ar":"كثافة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-112","he":"חיכוך","ar":"احتكاك","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-113","he":"כבידה","ar":"جاذبية","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-114","he":"תנודה","ar":"اهتزاز","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-115","he":"תדירות","ar":"تردد","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-116","he":"מחזור","ar":"دورة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-117","he":"גל","ar":"موجة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-118","he":"אורך גל","ar":"طول موجي","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-119","he":"משרעת","ar":"سعة الموجة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-120","he":"החזרה","ar":"انعكاس","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-121","he":"שבירה","ar":"انكسار","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-122","he":"חום","ar":"حرارة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-123","he":"טמפרטורה","ar":"درجة حرارة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-124","he":"הולכה","ar":"توصيل حراري / كهربائي حسب السياق","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-125","he":"שימור אנרגיה","ar":"حفظ الطاقة","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-126","he":"שיווי משקל","ar":"اتزان","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-127","he":"רכיב","ar":"مركّبة / عنصر","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-128","he":"רכיב אופקי","ar":"مركّبة أفقية","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"},{"id":"academic-129","he":"רכיב אנכי","ar":"مركّبة عمودية","groupId":"math-physics","groupTitle":"الرياضيات والفيزياء"}]},{"id":"electronics","title":"الكهرباء والإلكترونيكا","terms":[{"id":"academic-130","he":"חשמל","ar":"كهرباء","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-131","he":"אלקטרוניקה","ar":"إلكترونيات","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-132","he":"מעגל חשמלי","ar":"دائرة كهربائية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-133","he":"זרם חשמלי","ar":"تيار كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-134","he":"מתח","ar":"جهد كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-135","he":"התנגדות","ar":"مقاومة كهربائية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-136","he":"הספק חשמלי","ar":"قدرة كهربائية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-137","he":"מטען חשמלי","ar":"شحنة كهربائية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-138","he":"שדה חשמלי","ar":"مجال كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-139","he":"פוטנציאל חשמלי","ar":"جهد / كمون كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-140","he":"הארקה","ar":"تأريض","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-141","he":"קצר חשמלי","ar":"تماس كهربائي / قصر","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-142","he":"מקור מתח","ar":"مصدر جهد","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-143","he":"סוללה","ar":"بطارية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-144","he":"ספק כוח","ar":"مزود طاقة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-145","he":"מפסק","ar":"مفتاح كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-146","he":"מתג","ar":"قاطع / مفتاح","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-147","he":"נתיך","ar":"مصهر كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-148","he":"פיוז","ar":"فيوز","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-149","he":"חוט מוליך","ar":"سلك موصل","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-150","he":"מוליך","ar":"موصل","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-151","he":"מבודד","ar":"عازل","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-152","he":"מוליכות","ar":"موصلية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-153","he":"מוליכות חשמלית","ar":"موصلية كهربائية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-154","he":"נגד","ar":"مقاومة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-155","he":"קבל","ar":"مكثّف","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-156","he":"סליל","ar":"ملف / وشيعة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-157","he":"שנאי","ar":"محوّل كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-158","he":"דיודה","ar":"صمام ثنائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-159","he":"דיודה פולטת אור","ar":"صمام ثنائي باعث للضوء LED","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-160","he":"טרנזיסטור","ar":"ترانزستور","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-161","he":"מגבר","ar":"مضخّم","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-162","he":"מגבר שרת","ar":"مضخّم عمليات","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-163","he":"מיישר","ar":"مقوّم","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-164","he":"מסנן","ar":"مرشّح","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-165","he":"ממסר","ar":"مرحّل كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-166","he":"חיישן","ar":"مستشعر","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-167","he":"מנוע חשמלי","ar":"محرك كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-168","he":"גנרטור","ar":"مولّد كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-169","he":"תדר","ar":"تردد","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-170","he":"אות","ar":"إشارة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-171","he":"אות אנלוגי","ar":"إشارة تناظرية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-172","he":"אות דיגיטלי","ar":"إشارة رقمية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-173","he":"זרם ישר","ar":"تيار مستمر","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-174","he":"זרם חילופין","ar":"تيار متناوب","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-175","he":"תדר תהודה","ar":"تردد الرنين","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-176","he":"עכבה","ar":"ممانعة كهربائية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-177","he":"השראות","ar":"حثّ","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-178","he":"קיבול","ar":"سعة كهربائية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-179","he":"השראה אלקטרומגנטית","ar":"حث كهرومغناطيسي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-180","he":"שדה מגנטי","ar":"مجال مغناطيسي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-181","he":"שטף מגנטי","ar":"فيض مغناطيسي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-182","he":"קוטביות","ar":"قطبية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-183","he":"מגע","ar":"تماس / نقطة اتصال","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-184","he":"מחבר","ar":"موصل / وصلة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-185","he":"לוח מעגלים","ar":"لوحة دوائر","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-186","he":"מעגל מודפס","ar":"دائرة مطبوعة PCB","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-187","he":"רכיב אלקטרוני","ar":"مكوّن إلكتروني","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-188","he":"רכיב פעיל","ar":"عنصر فعّال","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-189","he":"רכיב סביל","ar":"عنصر سلبي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-190","he":"נקודת מדידה","ar":"نقطة قياس","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-191","he":"מד מתח","ar":"فولتميتر","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-192","he":"מד זרם","ar":"أميتر","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-193","he":"רב-מודד","ar":"ملتيميتر","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-194","he":"אוסצילוסקופ","ar":"راسم إشارة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-195","he":"מדידה","ar":"قياس","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-196","he":"כיול","ar":"معايرة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-197","he":"תקלה","ar":"عطل","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-198","he":"עומס","ar":"حمل كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-199","he":"הגנה","ar":"حماية","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-200","he":"בידוד חשמלי","ar":"عزل كهربائي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-201","he":"מעגל פתוח","ar":"دائرة مفتوحة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-202","he":"מעגל סגור","ar":"دائرة مغلقة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-203","he":"חיבור טורי","ar":"توصيل على التوالي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-204","he":"חיבור מקבילי","ar":"توصيل على التوازي","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-205","he":"חלוקת מתח","ar":"تقسيم الجهد","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-206","he":"חלוקת זרם","ar":"تقسيم التيار","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-207","he":"חוק אוהם","ar":"قانون أوم","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-208","he":"חוק קירכהוף","ar":"قانون كيرشوف","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-209","he":"הספק נצרך","ar":"قدرة مستهلكة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-210","he":"נצילות","ar":"كفاءة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-211","he":"הפסדים","ar":"فواقد","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-212","he":"התחממות","ar":"ارتفاع حرارة","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"},{"id":"academic-213","he":"קירור","ar":"تبريد","groupId":"electronics","groupTitle":"الكهرباء والإلكترونيكا"}]},{"id":"computing","title":"الحاسوب والبرمجة والأنظمة المدمجة","terms":[{"id":"academic-214","he":"מחשב","ar":"حاسوب","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-215","he":"תוכנה","ar":"برمجية","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-216","he":"חומרה","ar":"عتاد","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-217","he":"מערכת","ar":"نظام","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-218","he":"מערכת משובצת","ar":"نظام مدمج","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-219","he":"מעבד","ar":"معالج","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-220","he":"מיקרו-בקר","ar":"متحكم دقيق","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-221","he":"זיכרון","ar":"ذاكرة","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-222","he":"זיכרון RAM","ar":"ذاكرة الوصول العشوائي","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-223","he":"אחסון","ar":"تخزين","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-224","he":"קלט","ar":"إدخال","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-225","he":"פלט","ar":"إخراج","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-226","he":"קוד","ar":"شفرة برمجية","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-227","he":"תכנות","ar":"برمجة","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-228","he":"שפת תכנות","ar":"لغة برمجة","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-229","he":"פקודה","ar":"تعليمة","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-230","he":"לולאה","ar":"حلقة تكرار","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-231","he":"תנאי","ar":"شرط","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-232","he":"משתנה","ar":"متغير","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-233","he":"מערך","ar":"مصفوفة برمجية","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-234","he":"פונקציה","ar":"دالة برمجية","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-235","he":"אלגוריתם","ar":"خوارزمية","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-236","he":"מבנה נתונים","ar":"بنية بيانات","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-237","he":"איתור באגים","ar":"اكتشاف الأخطاء البرمجية","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-238","he":"ניפוי שגיאות","ar":"تصحيح الأخطاء","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-239","he":"ממשק","ar":"واجهة","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-240","he":"תקשורת","ar":"اتصالات","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-241","he":"פרוטוקול","ar":"بروتوكول","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-242","he":"רשת","ar":"شبكة","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-243","he":"שרת","ar":"خادم","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-244","he":"לקוח","ar":"عميل","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-245","he":"חיישן טמפרטורה","ar":"مستشعر حرارة","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-246","he":"בקר","ar":"متحكّم","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-247","he":"מפעיל","ar":"مشغّل","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-248","he":"זמן תגובה","ar":"زمن الاستجابة","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-249","he":"השהיה","ar":"تأخير","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-250","he":"סנכרון","ar":"مزامنة","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-251","he":"תזמון","ar":"جدولة / توقيت","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-252","he":"צריכת חשמל","ar":"استهلاك الكهرباء","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-253","he":"קושחה","ar":"برنامج ثابت Firmware","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-254","he":"עדכון","ar":"تحديث","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-255","he":"אבטחה","ar":"أمن","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-256","he":"הצפנה","ar":"تشفير","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-257","he":"נתון","ar":"بيان / قيمة بيانات","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-258","he":"קובץ","ar":"ملف","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-259","he":"תיקייה","ar":"مجلد","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"},{"id":"academic-260","he":"מסד נתונים","ar":"قاعدة بيانات","groupId":"computing","groupTitle":"الحاسوب والبرمجة والأنظمة المدمجة"}]},{"id":"verbs-adjectives","title":"أفعال وصفات أكاديمية شائعة","terms":[{"id":"academic-261","he":"להגדיר","ar":"يعرّف / يحدد","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-262","he":"להסביר","ar":"يشرح","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-263","he":"להוכיח","ar":"يثبت","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-264","he":"לחשב","ar":"يحسب","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-265","he":"למדוד","ar":"يقيس","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-266","he":"להשוות","ar":"يقارن","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-267","he":"לנתח","ar":"يحلّل","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-268","he":"לפתח","ar":"يطوّر","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-269","he":"לתכנן","ar":"يخطط / يصمم","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-270","he":"לבנות","ar":"يبني","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-271","he":"להרכיב","ar":"يركّب","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-272","he":"לפרק","ar":"يفكك","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-273","he":"לחבר","ar":"يوصل / يربط","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-274","he":"לנתק","ar":"يفصل","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-275","he":"להפעיל","ar":"يشغّل","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-276","he":"לכבות","ar":"يطفئ","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-277","he":"לבדוק","ar":"يفحص","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-278","he":"לוודא","ar":"يتأكد","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-279","he":"לזהות","ar":"يتعرّف / يحدد","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-280","he":"לאתר","ar":"يكتشف / يحدد موقع","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-281","he":"לתקן","ar":"يصلح","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-282","he":"לשפר","ar":"يحسّن","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-283","he":"להשפיע","ar":"يؤثر","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-284","he":"להתרחש","ar":"يحدث","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-285","he":"להתקיים","ar":"يوجد / يتحقق","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-286","he":"להשתמש","ar":"يستخدم","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-287","he":"להתבסס על","ar":"يستند إلى","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-288","he":"להוביל ל","ar":"يؤدي إلى","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-289","he":"לגרום ל","ar":"يسبب","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-290","he":"להציג","ar":"يعرض","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-291","he":"להדגים","ar":"يوضح بمثال","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-292","he":"להסיק","ar":"يستنتج","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-293","he":"להעריך","ar":"يقدّر / يقيّم","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-294","he":"להניח","ar":"يفترض","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-295","he":"לפתור","ar":"يحل","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-296","he":"להתקדם","ar":"يتقدم","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-297","he":"להתמודד עם","ar":"يتعامل مع","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-298","he":"להתמקד ב","ar":"يركّز على","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-299","he":"להשיג","ar":"يحقق / يحصل على","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-300","he":"לדרוש","ar":"يتطلب","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-301","he":"לאפשר","ar":"يتيح","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-302","he":"למנוע","ar":"يمنع","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-303","he":"להגדיל","ar":"يزيد","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-304","he":"להקטין","ar":"يقلل","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-305","he":"לשנות","ar":"يغيّر","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-306","he":"להישאר","ar":"يبقى","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-307","he":"להשתנות","ar":"يتغير","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-308","he":"מדויק","ar":"دقيق","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-309","he":"מורכב","ar":"معقّد","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-310","he":"פשוט","ar":"بسيط","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-311","he":"יעיל","ar":"فعّال","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-312","he":"אמין","ar":"موثوق","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-313","he":"יציב","ar":"مستقر","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-314","he":"זמני","ar":"مؤقت","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-315","he":"קבוע","ar":"ثابت","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-316","he":"חיוני","ar":"ضروري / حيوي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-317","he":"אפשרי","ar":"ممكن","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-318","he":"בלתי אפשרי","ar":"مستحيل","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-319","he":"דומה","ar":"مشابه","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-320","he":"שונה","ar":"مختلف","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-321","he":"עיקרי","ar":"رئيسي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-322","he":"משני","ar":"ثانوي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-323","he":"ממוצע","ar":"متوسط","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-324","he":"מרבי","ar":"أقصى","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-325","he":"מזערי","ar":"أدنى","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-326","he":"ישיר","ar":"مباشر","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-327","he":"עקיף","ar":"غير مباشر","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-328","he":"חיובי","ar":"موجب / إيجابي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-329","he":"שלילי","ar":"سالب / سلبي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-330","he":"יחסי","ar":"نسبي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-331","he":"מוחלט","ar":"مطلق","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-332","he":"תיאורטי","ar":"نظري","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-333","he":"מעשי","ar":"عملي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-334","he":"חשמלי","ar":"كهربائي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-335","he":"אלקטרוני","ar":"إلكتروني","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-336","he":"מכני","ar":"ميكانيكي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-337","he":"דיגיטלי","ar":"رقمي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-338","he":"אנלוגי","ar":"تناظري","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-339","he":"אוטומטי","ar":"تلقائي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-340","he":"ידני","ar":"يدوي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-341","he":"מקביל","ar":"متوازٍ","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-342","he":"טורי","ar":"متسلسل / على التوالي","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-343","he":"הפוך","ar":"عكسي / مقلوب","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-344","he":"שווה","ar":"متساوٍ","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-345","he":"בקירוב","ar":"تقريبًا","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-346","he":"בדיוק","ar":"بالضبط","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-347","he":"לפיכך","ar":"لذلك / بناءً عليه","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-348","he":"לעומת זאת","ar":"في المقابل","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-349","he":"בנוסף","ar":"بالإضافة إلى ذلك","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-350","he":"למרות זאת","ar":"رغم ذلك","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-351","he":"כתוצאה מכך","ar":"نتيجة لذلك","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-352","he":"מצד אחד","ar":"من جهة","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-353","he":"מצד שני","ar":"من جهة أخرى","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-354","he":"במקרה זה","ar":"في هذه الحالة","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-355","he":"באופן כללי","ar":"بشكل عام","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-356","he":"בפרט","ar":"على وجه الخصوص","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-357","he":"לדוגמה","ar":"على سبيل المثال","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-358","he":"כלומר","ar":"أي / بمعنى","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-359","he":"בהתאם ל","ar":"وفقًا لـ","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-360","he":"ביחס ל","ar":"بالنسبة إلى","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-361","he":"לפני","ar":"قبل","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-362","he":"אחרי","ar":"بعد","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-363","he":"במהלך","ar":"خلال","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-364","he":"בין","ar":"بين","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-365","he":"בתוך","ar":"داخل","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-366","he":"מחוץ ל","ar":"خارج","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-367","he":"לרבות","ar":"بما في ذلك","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-368","he":"אלא אם כן","ar":"إلا إذا","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-369","he":"ככל ש","ar":"كلما / بقدر ما","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-370","he":"במקום","ar":"بدلًا من / في مكان","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-371","he":"על אף","ar":"على الرغم من","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-372","he":"עקב","ar":"بسبب","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-373","he":"מאחר ש","ar":"بما أن","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-374","he":"מכיוון ש","ar":"لأن","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-375","he":"לשם כך","ar":"لهذا الغرض","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-376","he":"במטרה ל","ar":"بهدف","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"},{"id":"academic-377","he":"כתנאי ל","ar":"كشرط لـ","groupId":"verbs-adjectives","groupTitle":"أفعال وصفات أكاديمية شائعة"}]}];
  const TERMS = GROUPS.flatMap(group => group.terms);
  window.YaelAcademicTerms = TERMS;
  const STORAGE_KEY = "mila-yaelnet-academic-v1";
  const DAY = 86400000;
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
  const normalize = value => String(value || "").normalize("NFC").toLocaleLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[.,،؛:!?؟()[\]{}"'«»/|\\_–—-]/g, " ")
    .replace(/\s+/g, " ").trim();
  const shuffle = list => {
    const result = list.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const defaultState = () => ({ version: 1, progress: {}, adaptiveEvents: [] });
  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.version === 1 && saved.progress && typeof saved.progress === "object" && !Array.isArray(saved.progress)) {
        if (!Array.isArray(saved.adaptiveEvents)) saved.adaptiveEvents = [];
        return saved;
      }
    } catch (_) {}
    return defaultState();
  };
  const data = loadState();
  let academicViewOpen = false;
  const ui = {
    mode: "list", groupId: "all", filter: "all", query: "",
    studyTerms: [], studyIndex: 0, revealed: false,
    quiz: null, direction: "he-ar"
  };
  let navButton = null;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (_) {
      showToast("تعذر حفظ تقدم المصطلحات. تحقّق من مساحة التخزين في المتصفح.", "error");
      return false;
    }
  }
  function showToast(message, kind) {
    let node = $("academicToast");
    if (!node) {
      node = document.createElement("div");
      node.id = "academicToast";
      node.className = "academic-toast";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.kind = kind || "success";
    node.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { node.hidden = true; }, 2800);
  }
  function progressOf(term) {
    return data.progress[term.id] || { attempts: 0, correct: 0, incorrect: 0, mastered: false, favorite: false, dueAt: 0 };
  }
  function updateProgress(term, correct, dueDelay) {
    const previous = progressOf(term);
    data.progress[term.id] = {
      ...previous,
      attempts: (Number(previous.attempts) || 0) + 1,
      correct: (Number(previous.correct) || 0) + (correct ? 1 : 0),
      incorrect: (Number(previous.incorrect) || 0) + (correct ? 0 : 1),
      lastReviewedAt: Date.now(),
      dueAt: Date.now() + dueDelay
    };
    if (!correct) data.progress[term.id].mastered = false;
    save();
  }
  function recordAdaptiveProgress(eventId, termId, correct, at) {
    if (typeof eventId !== "string" || !eventId || !TERMS.some(term => term.id === termId) || typeof correct !== "boolean") return false;
    if (!Array.isArray(data.adaptiveEvents)) data.adaptiveEvents = [];
    if (data.adaptiveEvents.includes(eventId)) return true;
    const previous = data.progress[termId] ? { ...data.progress[termId] } : undefined;
    const previousEvents = data.adaptiveEvents.slice();
    const now = Number(at) || Date.now();
    const current = progressOf(TERMS.find(term => term.id === termId));
    data.progress[termId] = {
      ...current,
      attempts: (Number(current.attempts) || 0) + 1,
      correct: (Number(current.correct) || 0) + (correct ? 1 : 0),
      incorrect: (Number(current.incorrect) || 0) + (correct ? 0 : 1),
      mastered: correct ? Boolean(current.mastered) : false,
      lastReviewedAt: now,
      dueAt: now + (correct ? 3 * DAY : 30 * 60000)
    };
    data.adaptiveEvents.push(eventId);
    if (data.adaptiveEvents.length > 10000) data.adaptiveEvents.splice(0, data.adaptiveEvents.length - 10000);
    if (!save()) {
      if (previous) data.progress[termId] = previous; else delete data.progress[termId];
      data.adaptiveEvents = previousEvents;
      return false;
    }
    if (academicViewOpen && ui.mode === "list") render();
    return true;
  }
  window.MilaAcademicProgressBridge = Object.freeze({ recordAdaptiveAnswer: recordAdaptiveProgress });

  function toggleMastered(id) {
    const term = TERMS.find(item => item.id === id);
    if (!term) return;
    const p = progressOf(term);
    data.progress[id] = { ...p, mastered: !p.mastered, dueAt: p.mastered ? Date.now() + 15 * 60000 : Date.now() + 7 * DAY };
    save();
    render();
  }
  function toggleFavorite(id) {
    const term = TERMS.find(item => item.id === id);
    if (!term) return;
    const p = progressOf(term);
    data.progress[id] = { ...p, favorite: !p.favorite };
    save();
    render();
  }
  function stats() {
    const records = TERMS.map(progressOf);
    const attempts = records.reduce((n, p) => n + (Number(p.attempts) || 0), 0);
    const correct = records.reduce((n, p) => n + (Number(p.correct) || 0), 0);
    return {
      total: TERMS.length,
      mastered: records.filter(p => p.mastered).length,
      favorites: records.filter(p => p.favorite).length,
      attempts,
      accuracy: attempts ? Math.round(correct / attempts * 100) : 0,
      due: records.filter(p => p.dueAt && Number(p.dueAt) <= Date.now()).length
    };
  }
  function filteredTerms() {
    const query = normalize(ui.query);
    return TERMS.filter(term => {
      const p = progressOf(term);
      if (ui.groupId !== "all" && term.groupId !== ui.groupId) return false;
      if (ui.filter === "mastered" && !p.mastered) return false;
      if (ui.filter === "favorites" && !p.favorite) return false;
      if (ui.filter === "new" && (Number(p.attempts) || 0) > 0) return false;
      if (ui.filter === "due" && (!p.dueAt || Number(p.dueAt) > Date.now())) return false;
      if (query && !normalize(term.he).includes(query) && !normalize(term.ar).includes(query)) return false;
      return true;
    });
  }
  function renderNav() {
    const mainNav = $("mainNav");
    if (!mainNav) return;
    navButton = $("academicNavButton");
    if (!navButton) {
      navButton = document.createElement("button");
      navButton.id = "academicNavButton";
      navButton.type = "button";
      navButton.className = "nav-item academic-nav-item";
      navButton.setAttribute("data-academic-open", "true");
      navButton.innerHTML = '<span class="nav-icon" aria-hidden="true">⌘</span><span>مصطلحات أكاديمية</span><span class="nav-count">377</span>';
      const libraryButton = mainNav.querySelector('[data-view="library"]');
      if (libraryButton) libraryButton.insertAdjacentElement("afterend", navButton);
      else mainNav.appendChild(navButton);
    }
  }
  function setActiveNavigation(active) {
    document.querySelectorAll("#mainNav .nav-item").forEach(button => button.classList.toggle("active", button === active));
  }
  function openView() {
    academicViewOpen = true;
    ui.mode = "list";
    const title = $("breadcrumbTitle");
    if (title) title.textContent = "مصطلحات أكاديمية";
    setActiveNavigation(navButton);
    document.body.classList.remove("sidebar-open");
    const backdrop = $("sidebarBackdrop");
    if (backdrop) backdrop.hidden = true;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function pageHead() {
    const s = stats();
    return '<div class="academic-head">' +
      '<div><div class="academic-eyebrow">ACADEMIC VOCABULARY · 377 TERMS</div>' +
      '<h1>مصطلحات أكاديمية</h1>' +
      '<p>مصطلحات الدراسة الجامعية والرياضيات والفيزياء والكهرباء والبرمجة، مع ترجمتها العربية ومراجعتها.</p></div>' +
      '<div class="academic-head-actions">' +
      '<button class="academic-button academic-button-primary" data-academic-action="start-study">بطاقات الدراسة</button>' +
      '<button class="academic-button academic-button-secondary" data-academic-action="start-quiz">اختبار سريع</button>' +
      '</div></div>' +
      '<div class="academic-stats">' +
      '<div class="academic-stat"><span>إجمالي المصطلحات</span><strong>' + s.total + '</strong></div>' +
      '<div class="academic-stat"><span>متقنة</span><strong>' + s.mastered + '</strong></div>' +
      '<div class="academic-stat"><span>المفضلة</span><strong>' + s.favorites + '</strong></div>' +
      '<div class="academic-stat"><span>دقة الاختبارات</span><strong>' + s.accuracy + '%</strong></div>' +
      '</div>';
  }
  function renderList() {
    const terms = filteredTerms();
    const groupButtons = '<button class="academic-category ' + (ui.groupId === "all" ? "active" : "") + '" data-academic-action="group" data-group="all">الكل <small>' + TERMS.length + '</small></button>' +
      GROUPS.map(group => '<button class="academic-category ' + (ui.groupId === group.id ? "active" : "") + '" data-academic-action="group" data-group="' + esc(group.id) + '">' + esc(group.title) + ' <small>' + group.terms.length + '</small></button>').join("");
    const filterButtons = [["all","الكل"],["new","جديدة"],["mastered","متقنة"],["favorites","المفضلة"],["due","تحتاج مراجعة"]]
      .map(([id,label]) => '<button class="academic-filter ' + (ui.filter === id ? "active" : "") + '" data-academic-action="filter" data-filter="' + id + '">' + label + '</button>').join("");
    const cards = terms.map(term => {
      const p = progressOf(term);
      const attempts = Number(p.attempts) || 0;
      const rate = attempts ? Math.round((Number(p.correct) || 0) / attempts * 100) : 0;
      return '<article class="academic-term-card">' +
        '<div class="academic-term-top"><span class="academic-domain">' + esc(term.groupTitle) + '</span>' +
        '<span class="academic-number">#' + term.id.slice(-3) + '</span></div>' +
        '<div class="academic-hebrew" lang="he" dir="rtl">' + esc(term.he) + '</div>' +
        '<div class="academic-arabic">' + esc(term.ar) + '</div>' +
        '<div class="academic-term-footer"><span>' + (attempts ? rate + '% دقة · ' + attempts + ' محاولات' : "لم تُراجع بعد") + '</span>' +
        '<div class="academic-term-actions">' +
        '<button type="button" class="academic-icon-button ' + (p.favorite ? "active" : "") + '" aria-label="' + (p.favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة") + '" title="المفضلة" data-academic-action="favorite" data-id="' + term.id + '">★</button>' +
        '<button type="button" class="academic-icon-button ' + (p.mastered ? "active" : "") + '" aria-label="' + (p.mastered ? "إلغاء الإتقان" : "تحديد كمتقنة") + '" title="الإتقان" data-academic-action="mastered" data-id="' + term.id + '">✓</button>' +
        '</div></div></article>';
    }).join("");
    return '<section class="academic-panel">' +
      '<div class="academic-categories" role="tablist" aria-label="مجالات المصطلحات">' + groupButtons + '</div>' +
      '<div class="academic-toolbar"><label class="academic-search"><span aria-hidden="true">⌕</span>' +
      '<input id="academicSearch" type="search" value="' + esc(ui.query) + '" placeholder="ابحث بالعبرية أو العربية…" autocomplete="off" aria-label="ابحث عن مصطلح">' +
      '</label><div class="academic-filters" aria-label="تصفية المصطلحات">' + filterButtons + '</div></div>' +
      '<div class="academic-results-heading"><div><h2>قائمة المصطلحات</h2><p>' + terms.length + ' من ' + TERMS.length + ' مصطلحًا</p></div>' +
      '<label class="academic-direction">اتجاه الاختبار <select id="academicDirection"><option value="he-ar" ' + (ui.direction === "he-ar" ? "selected" : "") + '>عبري ← عربي</option><option value="ar-he" ' + (ui.direction === "ar-he" ? "selected" : "") + '>عربي ← عبري</option></select></label></div>' +
      (cards ? '<div class="academic-term-grid">' + cards + '</div>' :
        '<div class="academic-empty"><span>⌕</span><strong>لا توجد نتائج مطابقة</strong><p>غيّر مجال البحث أو أزل بعض عوامل التصفية.</p><button class="academic-button academic-button-secondary" data-academic-action="reset">إعادة ضبط البحث</button></div>') +
      '</section>';
  }
  function renderStudy() {
    const list = ui.studyTerms;
    if (!list.length) return '<div class="academic-mode"><div class="academic-empty"><strong>لا توجد مصطلحات للدراسة</strong><p>وسّع التصفية أو اختر مجالًا آخر.</p><button class="academic-button academic-button-secondary" data-academic-action="back">العودة للقائمة</button></div></div>';
    if (ui.studyIndex >= list.length) {
      return '<div class="academic-mode"><div class="academic-complete"><div class="academic-complete-icon">✓</div><h2>أكملت بطاقات الدراسة</h2><p>راجعت ' + list.length + ' مصطلحًا في هذه الجولة.</p><button class="academic-button academic-button-primary" data-academic-action="back">العودة إلى المصطلحات</button></div></div>';
    }
    const term = list[ui.studyIndex];
    const p = progressOf(term);
    const pct = Math.round((ui.studyIndex / list.length) * 100);
    return '<div class="academic-mode">' +
      '<div class="academic-mode-top"><button class="academic-button academic-button-quiet" data-academic-action="back">← قائمة المصطلحات</button><span>بطاقة ' + (ui.studyIndex + 1) + ' من ' + list.length + '</span></div>' +
      '<div class="academic-progress-track"><span style="width:' + pct + '%"></span></div>' +
      '<article class="academic-flashcard">' +
      '<span class="academic-domain">' + esc(term.groupTitle) + '</span>' +
      '<div class="academic-flash-he" lang="he" dir="rtl">' + esc(term.he) + '</div>' +
      (ui.revealed ? '<div class="academic-flash-divider"></div><div class="academic-flash-ar">' + esc(term.ar) + '</div>' :
        '<p class="academic-flash-hint">حاول تذكّر المعنى قبل إظهاره</p>') +
      '<div class="academic-flash-actions">' +
      (ui.revealed ?
        '<button class="academic-button academic-button-secondary" data-academic-action="study-again">أحتاج إلى مراجعة</button><button class="academic-button academic-button-primary" data-academic-action="study-known">عرفت المعنى</button>' :
        '<button class="academic-button academic-button-primary" data-academic-action="reveal">إظهار الترجمة</button>') +
      '</div></article>' +
      '<div class="academic-study-note">يمكنك استخدام مفتاح المسافة لإظهار الترجمة، والسهمين للتنقل.</div>' +
      '<div class="academic-mode-bottom"><button class="academic-button academic-button-quiet" data-academic-action="study-prev" ' + (ui.studyIndex === 0 ? "disabled" : "") + '>السابق</button>' +
      '<button class="academic-button academic-button-quiet" data-academic-action="study-next">تخطي</button></div></div>';
  }
  function buildQuiz(list, direction) {
    const questions = shuffle(list).slice(0, Math.min(10, list.length)).map(term => {
      const answerField = direction === "ar-he" ? "he" : "ar";
      const promptField = direction === "ar-he" ? "ar" : "he";
      const correct = normalize(term[answerField]);
      const candidates = shuffle(TERMS.filter(item => item.id !== term.id && item.groupId === term.groupId && normalize(item[answerField]) !== correct));
      const choices = [term];
      const seen = new Set([correct]);
      for (const candidate of candidates) {
        const key = normalize(candidate[answerField]);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        choices.push(candidate);
        if (choices.length === 4) break;
      }
      return {
        term,
        prompt: term[promptField],
        answer: term[answerField],
        choices: shuffle(choices).map(item => ({ id: item.id, text: item[answerField] }))
      };
    }).filter(question => question.choices.length >= 2);
    return { questions, index: 0, correct: 0, selectedId: null, answered: false };
  }
  function renderQuiz() {
    const quiz = ui.quiz;
    if (!quiz) return '<div class="academic-empty"><p>لم يتم إنشاء الاختبار.</p><button class="academic-button" data-academic-action="back">عودة</button></div>';
    if (quiz.index >= quiz.questions.length) {
      const total = quiz.questions.length;
      const accuracy = total ? Math.round(quiz.correct / total * 100) : 0;
      return '<div class="academic-mode"><div class="academic-complete"><div class="academic-complete-icon">✓</div>' +
        '<h2>انتهى الاختبار</h2><div class="academic-score">' + quiz.correct + '<small> / ' + total + '</small></div>' +
        '<p>دقتك في هذه الجولة: ' + accuracy + '%</p>' +
        '<button class="academic-button academic-button-primary" data-academic-action="restart-quiz">اختبار جديد</button>' +
        '<button class="academic-button academic-button-secondary" data-academic-action="back">العودة إلى المصطلحات</button></div></div>';
    }
    const q = quiz.questions[quiz.index];
    const pct = Math.round((quiz.index / quiz.questions.length) * 100);
    const choices = q.choices.map(choice => {
      let cls = "academic-choice";
      if (quiz.answered && choice.id === q.term.id) cls += " correct";
      else if (quiz.answered && choice.id === quiz.selectedId) cls += " incorrect";
      return '<button type="button" class="' + cls + '" data-academic-action="quiz-answer" data-id="' + choice.id + '" ' + (quiz.answered ? "disabled" : "") + '>' +
        '<span>' + esc(choice.text) + '</span><small>' + (q.choices.findIndex(item => item.id === choice.id) + 1) + '</small></button>';
    }).join("");
    return '<div class="academic-mode">' +
      '<div class="academic-mode-top"><button class="academic-button academic-button-quiet" data-academic-action="back">← إنهاء الاختبار</button><span>السؤال ' + (quiz.index + 1) + ' من ' + quiz.questions.length + ' · صحيح ' + quiz.correct + '</span></div>' +
      '<div class="academic-progress-track"><span style="width:' + pct + '%"></span></div>' +
      '<article class="academic-question"><span class="academic-domain">' + esc(q.term.groupTitle) + '</span>' +
      '<p class="academic-question-label">' + (ui.direction === "he-ar" ? "اختر المعنى العربي الصحيح" : "اختر المصطلح العبري الصحيح") + '</p>' +
      '<h2 class="' + (ui.direction === "he-ar" ? "academic-question-he" : "academic-question-ar") + '" dir="' + (ui.direction === "he-ar" ? "rtl" : "rtl") + '">' + esc(q.prompt) + '</h2>' +
      '<div class="academic-choices">' + choices + '</div>' +
      (quiz.answered ? '<div class="academic-feedback ' + (quiz.selectedId === q.term.id ? "good" : "bad") + '">' +
        (quiz.selectedId === q.term.id ? "إجابة صحيحة" : "الإجابة الصحيحة: " + esc(q.answer)) + '</div>' +
        '<button class="academic-button academic-button-primary academic-next" data-academic-action="quiz-next">' + (quiz.index + 1 === quiz.questions.length ? "عرض النتيجة" : "السؤال التالي") + '</button>' : '') +
      '</article></div>';
  }
  function render() {
    const root = $("appView");
    if (!root) return;
    root.innerHTML = '<div class="academic-page">' + pageHead() +
      (ui.mode === "study" ? renderStudy() : ui.mode === "quiz" ? renderQuiz() : renderList()) +
      '</div>';
  }
  function startStudy() {
    ui.studyTerms = shuffle(filteredTerms());
    ui.studyIndex = 0;
    ui.revealed = false;
    ui.mode = "study";
    render();
  }
  function startQuiz() {
    const list = filteredTerms();
    if (list.length < 2) {
      showToast("يلزم وجود مصطلحين على الأقل لإنشاء اختبار.", "error");
      return;
    }
    ui.quiz = buildQuiz(list, ui.direction);
    if (!ui.quiz.questions.length) { ui.quiz = null; showToast("لا تتوفر خيارات كافية لهذا الاختبار بعد التصفية.", "error"); return; }
    ui.mode = "quiz";
    render();
  }
  function handleAction(action, target) {
    const id = target.dataset.id;
    if (action === "group") { ui.groupId = target.dataset.group || "all"; ui.filter = "all"; ui.mode = "list"; render(); return; }
    if (action === "filter") { ui.filter = target.dataset.filter || "all"; render(); return; }
    if (action === "reset") { ui.query = ""; ui.groupId = "all"; ui.filter = "all"; render(); return; }
    if (action === "favorite") { toggleFavorite(id); return; }
    if (action === "mastered") { toggleMastered(id); return; }
    if (action === "start-study") { startStudy(); return; }
    if (action === "start-quiz") { startQuiz(); return; }
    if (action === "back") { ui.mode = "list"; ui.quiz = null; render(); return; }
    if (action === "reveal") { ui.revealed = true; render(); return; }
    if (action === "study-known" || action === "study-again") {
      const term = ui.studyTerms[ui.studyIndex];
      if (term) {
        updateProgress(term, action === "study-known", action === "study-known" ? 7 * DAY : 20 * 60000);
        const p = progressOf(term);
        data.progress[term.id] = { ...p, mastered: action === "study-known" ? true : false };
        save();
      }
      ui.studyIndex += 1; ui.revealed = false; render(); return;
    }
    if (action === "study-prev") { ui.studyIndex = Math.max(0, ui.studyIndex - 1); ui.revealed = false; render(); return; }
    if (action === "study-next") { ui.studyIndex = Math.min(ui.studyTerms.length, ui.studyIndex + 1); ui.revealed = false; render(); return; }
    if (action === "quiz-answer" && ui.quiz && !ui.quiz.answered) {
      const q = ui.quiz.questions[ui.quiz.index];
      ui.quiz.selectedId = id;
      ui.quiz.answered = true;
      const correct = id === q.term.id;
      if (correct) ui.quiz.correct += 1;
      updateProgress(q.term, correct, correct ? 3 * DAY : 30 * 60000);
      if (correct) {
        const p = progressOf(q.term);
        data.progress[q.term.id] = { ...p, mastered: p.mastered || false };
        save();
      }
      render(); return;
    }
    if (action === "quiz-next" && ui.quiz) {
      ui.quiz.index += 1; ui.quiz.selectedId = null; ui.quiz.answered = false; render(); return;
    }
    if (action === "restart-quiz") { startQuiz(); return; }
  }

  document.addEventListener("click", event => {
    const nav = event.target.closest("[data-academic-open]");
    if (nav) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      openView(); return;
    }
    const actionButton = event.target.closest("[data-academic-action]");
    if (actionButton) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      handleAction(actionButton.dataset.academicAction, actionButton);
      return;
    }
    const normalNav = event.target.closest("#mainNav [data-view]");
    if (normalNav || event.target.closest("[data-adaptive-open]")) academicViewOpen = false;
    if (normalNav && navButton) navButton.classList.remove("active");
  }, true);
  document.addEventListener("input", event => {
    if (event.target && event.target.id === "academicSearch") {
      ui.query = event.target.value;
      const position = event.target.selectionStart;
      render();
      const input = $("academicSearch");
      if (input) { input.focus(); input.setSelectionRange(position, position); }
      event.stopPropagation();
    }
  }, true);
  document.addEventListener("change", event => {
    if (event.target && event.target.id === "academicDirection") {
      ui.direction = event.target.value === "ar-he" ? "ar-he" : "he-ar";
      event.stopPropagation();
    }
  }, true);
  document.addEventListener("keydown", event => {
    if (ui.mode === "list") return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); ui.mode = "list"; render(); return; }
    if (ui.mode === "study" && event.key === " " && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) {
      event.preventDefault(); event.stopPropagation(); ui.revealed = !ui.revealed; render(); return;
    }
    if (ui.mode === "quiz" && !ui.quiz?.answered && /^[1-4]$/.test(event.key)) {
      const q = ui.quiz.questions[ui.quiz.index];
      const choice = q.choices[Number(event.key) - 1];
      if (choice) { event.preventDefault(); event.stopPropagation(); handleAction("quiz-answer", { dataset: { id: choice.id } }); }
    }
  }, true);

  renderNav();
  if (typeof window !== "undefined") {
    window.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY) {
        Object.assign(data, loadState());
        if (ui.mode === "list") render();
      }
    });
  }
})();

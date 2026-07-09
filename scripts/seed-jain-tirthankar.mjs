/**
 * Demo content seeder — Jain knowledge competition (Gujarati).
 *
 * Creates 5 reusable library Rounds (one per Tirthankar) and 50 reusable
 * library Questions (10 per round: 4 EASY, 4 MEDIUM, 2 HARD), then attaches
 * each round's 10 questions in order. Rounds 1 & 2 are MCQ (options + isMCQ);
 * rounds 3–5 are question + hint only. Every question carries >= 2 Gujarati
 * hints that reveal the answer progressively.
 *
 * This ONLY writes demo content into the existing collections — it changes no
 * app code and follows the same direct-insert pattern as simulation-check.mjs.
 * Re-running it is idempotent: it deletes any prior copy of this seed (tracked
 * by a hostNotes marker + the 5 round titles) before re-inserting.
 *
 *   node scripts/seed-jain-tirthankar.mjs
 *
 * Owner: the real ADMIN account (email "admin"), falling back to the first
 * ADMIN, then the first user. Override with OWNER_EMAIL=you@example.com.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const env = fs.readFileSync(".env.local", "utf8");
const mongoUri = env.match(/MONGODB_URI="?([^"\n]+)"?/)?.[1];
if (!mongoUri) throw new Error("MONGODB_URI missing in .env.local");

const { ObjectId } = mongoose.Types;
const now = () => new Date();
const oid = () => new ObjectId();
const SEED_MARKER = "[seed:jain-tirthankar-v1]";

/* ─────────────── content ─────────────── */

const BASE_TAGS = ["જૈન ધર્મ", "તીર્થંકર", "જીવન ચરિત્ર"];

// h(...) = ordered hints (progressively revealing). o(...) = MCQ options.
const h = (...texts) => texts.map((text) => ({ text, penalty: 0 }));

const ROUNDS = [
  {
    title: "શ્રી આદિનાથ ભગવાન જીવન ચરિત્ર",
    description: "પ્રથમ તીર્થંકર શ્રી આદિનાથ (ઋષભદેવ) ભગવાનના જીવન વિશે પ્રશ્નો.",
    specificTag: "આદિનાથ",
    mcq: true,
    questions: [
      {
        difficulty: "EASY",
        question: "શ્રી આદિનાથ ભગવાનના પિતાનું નામ શું હતું?",
        options: ["નાભિરાજા", "સિદ્ધાર્થ રાજા", "સમુદ્રવિજય રાજા", "અશ્વસેન રાજા"],
        answer: "નાભિરાજા",
        hints: h("તેઓ એક કુલકર (રાજા) હતા.", "તેમનું નામ 'ના' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી આદિનાથ ભગવાનની માતાનું નામ શું હતું?",
        options: ["મરુદેવા", "ત્રિશલા", "વિજયા", "સિદ્ધાર્થા"],
        answer: "મરુદેવા",
        hints: h("તેઓ આ અવસર્પિણી કાળમાં પ્રથમ મોક્ષે જનાર માતા મનાય છે.", "તેમનું નામ 'મ' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી આદિનાથ ભગવાનનું લાંછન (ચિહ્ન) શું છે?",
        options: ["બળદ", "હાથી", "ઘોડો", "સિંહ"],
        answer: "બળદ",
        hints: h("તે એક પ્રાણીનું ચિહ્ન છે.", "તે ખેતી સાથે જોડાયેલ પ્રાણી છે જે હળ ખેંચે છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી આદિનાથ ભગવાનનું જન્મ સ્થળ કયું હતું?",
        options: ["અયોધ્યા", "શ્રાવસ્તી", "કાશી", "ચંપાપુરી"],
        answer: "અયોધ્યા",
        hints: h("આ નગરી 'વિનીતા' નામથી પણ ઓળખાતી હતી.", "આ જ નગરીમાં ભગવાન રામનો પણ જન્મ મનાય છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી આદિનાથ ભગવાન કયા ક્રમના તીર્થંકર છે?",
        options: ["પ્રથમ", "બીજા", "ત્રીજા", "ચોવીસમા"],
        answer: "પ્રથમ",
        hints: h("આ અવસર્પિણી કાળના સૌથી પહેલા તીર્થંકર.", "'આદિ' એટલે શરૂઆત — તેથી નામ આદિનાથ."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી આદિનાથ ભગવાનનું બીજું પ્રચલિત નામ શું છે?",
        options: ["ઋષભદેવ", "નેમિનાથ", "પાર્શ્વનાથ", "મહાવીર"],
        answer: "ઋષભદેવ",
        hints: h("માતાએ સ્વપ્નમાં પ્રથમ ઋષભ (બળદ) જોયો હતો તેથી આ નામ.", "નામમાં 'ઋષભ' શબ્દ આવે છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી આદિનાથ ભગવાનના જ્યેષ્ઠ પુત્ર, જે પ્રથમ ચક્રવર્તી બન્યા, તેમનું નામ શું હતું?",
        options: ["ભરત", "બાહુબલી", "ગૌતમ", "શ્રેણિક"],
        answer: "ભરત",
        hints: h("ભારત દેશનું નામ તેમના પરથી પડ્યું મનાય છે.", "તેમનું નામ 'ભ' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી આદિનાથ ભગવાનની કઈ પુત્રીના નામ પરથી લિપિ (લખાણ)નું નામ પડ્યું?",
        options: ["બ્રાહ્મી", "સુંદરી", "ચંદના", "મરુદેવા"],
        answer: "બ્રાહ્મી",
        hints: h("'બ્રાહ્મી લિપિ' તેમના નામ પરથી ઓળખાય છે.", "તેમનું નામ 'બ્રા' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "HARD",
        question: "શ્રી આદિનાથ ભગવાનનું નિર્વાણ (મોક્ષ) સ્થળ કયું છે?",
        options: ["અષ્ટાપદ", "સમ્મેદ શિખર", "પાવાપુરી", "ગિરનાર"],
        answer: "અષ્ટાપદ",
        hints: h("આ પર્વત કૈલાસ પાસે આવેલ મનાય છે.", "તેના નામમાં 'આઠ' (અષ્ટ) સંખ્યા આવે છે."),
      },
      {
        difficulty: "HARD",
        question: "શ્રી આદિનાથ ભગવાનના શરીરનો વર્ણ કયો હતો?",
        options: ["સુવર્ણ (પીળો)", "શ્યામ (કાળો)", "રક્ત (લાલ)", "શ્વેત (સફેદ)"],
        answer: "સુવર્ણ (પીળો)",
        hints: h("તેમના શરીરનો રંગ સોના જેવો હતો.", "પ્રથમ પાંચ તીર્થંકરોનો આ જ વર્ણ મનાય છે."),
      },
    ],
  },
  {
    title: "શ્રી અજિતનાથ ભગવાન જીવન ચરિત્ર",
    description: "બીજા તીર્થંકર શ્રી અજિતનાથ ભગવાનના જીવન વિશે પ્રશ્નો.",
    specificTag: "અજિતનાથ",
    mcq: true,
    questions: [
      {
        difficulty: "EASY",
        question: "શ્રી અજિતનાથ ભગવાનના પિતાનું નામ શું હતું?",
        options: ["જિતશત્રુ", "નાભિરાજા", "જિતારિ", "સંવર"],
        answer: "જિતશત્રુ",
        hints: h("તેમના નામમાં 'જીત' શબ્દ આવે છે.", "તેમનું નામ 'જિ' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી અજિતનાથ ભગવાનની માતાનું નામ શું હતું?",
        options: ["વિજયા", "મરુદેવા", "સેના", "સિદ્ધાર્થા"],
        answer: "વિજયા",
        hints: h("તેમના નામનો અર્થ 'જીત' થાય છે.", "તેમનું નામ 'વિ' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી અજિતનાથ ભગવાનનું લાંછન (ચિહ્ન) શું છે?",
        options: ["હાથી", "બળદ", "ઘોડો", "વાંદરો"],
        answer: "હાથી",
        hints: h("તે સૌથી મોટું જમીની પ્રાણી છે.", "તેને લાંબી સૂંઢ હોય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી અજિતનાથ ભગવાનનું જન્મ સ્થળ કયું હતું?",
        options: ["અયોધ્યા", "શ્રાવસ્તી", "ચંપાપુરી", "રાજગૃહી"],
        answer: "અયોધ્યા",
        hints: h("શ્રી આદિનાથ ભગવાનની પણ આ જ જન્મનગરી હતી.", "તેમનું નામ 'અ' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી અજિતનાથ ભગવાન કયા ક્રમના તીર્થંકર છે?",
        options: ["બીજા", "પ્રથમ", "ત્રીજા", "પાંચમા"],
        answer: "બીજા",
        hints: h("શ્રી આદિનાથ ભગવાન પછી તરત જ આવે છે.", "તેમનો ક્રમ ૨ છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "'અજિત' નામનો અર્થ શું થાય છે?",
        options: ["જેને કોઈ જીતી ન શકે", "જે દયાળુ છે", "જે પ્રથમ છે", "જે તેજસ્વી છે"],
        answer: "જેને કોઈ જીતી ન શકે",
        hints: h("આ શબ્દ 'અ + જિત' થી બન્યો છે.", "એટલે કે અજેય — જેને હરાવી ન શકાય."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી અજિતનાથ ભગવાનના શરીરનો વર્ણ કયો હતો?",
        options: ["સુવર્ણ (પીળો)", "શ્યામ (કાળો)", "નીલ (વાદળી)", "રક્ત (લાલ)"],
        answer: "સુવર્ણ (પીળો)",
        hints: h("શ્રી આદિનાથ ભગવાન જેવો જ વર્ણ હતો.", "તેમના શરીરનો રંગ સોના જેવો હતો."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી અજિતનાથ ભગવાનનું નિર્વાણ (મોક્ષ) સ્થળ કયું છે?",
        options: ["સમ્મેદ શિખર", "અષ્ટાપદ", "પાવાપુરી", "ગિરનાર"],
        answer: "સમ્મેદ શિખર",
        hints: h("આ પર્વત ઝારખંડમાં આવેલ છે.", "અહીં કુલ વીસ તીર્થંકરો મોક્ષ પામ્યા છે."),
      },
      {
        difficulty: "HARD",
        question: "શ્રી અજિતનાથ ભગવાનના પિતા જિતશત્રુ કઈ નગરીના રાજા હતા?",
        options: ["અયોધ્યા", "શ્રાવસ્તી", "હસ્તિનાપુર", "મિથિલા"],
        answer: "અયોધ્યા",
        hints: h("જ્યાં અજિતનાથનો જન્મ થયો તે જ નગરી.", "ઇક્ષ્વાકુ વંશની આ રાજધાની હતી."),
      },
      {
        difficulty: "HARD",
        question: "શ્રી અજિતનાથ ભગવાન કયા વંશમાં જન્મ્યા હતા?",
        options: ["ઇક્ષ્વાકુ વંશ", "હરિવંશ", "યદુવંશ", "કુરુવંશ"],
        answer: "ઇક્ષ્વાકુ વંશ",
        hints: h("શ્રી આદિનાથ ભગવાનનો પણ આ જ વંશ હતો.", "તેનું નામ 'ઇ' અક્ષરથી શરૂ થાય છે."),
      },
    ],
  },
  {
    title: "શ્રી સંભવનાથ ભગવાન જીવન ચરિત્ર",
    description: "ત્રીજા તીર્થંકર શ્રી સંભવનાથ ભગવાનના જીવન વિશે પ્રશ્નો.",
    specificTag: "સંભવનાથ",
    mcq: false,
    questions: [
      {
        difficulty: "EASY",
        question: "શ્રી સંભવનાથ ભગવાનના પિતાનું નામ શું હતું?",
        answer: "જિતારિ",
        hints: h("તેમના નામમાં 'જિત' ધ્વનિ આવે છે.", "તેમનું નામ 'જિ' થી શરૂ થઈ 'રિ' થી પૂરું થાય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી સંભવનાથ ભગવાનની માતાનું નામ શું હતું?",
        answer: "સેના",
        hints: h("તે બે અક્ષરનું ટૂંકું નામ છે.", "તેમનું નામ 'સે' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી સંભવનાથ ભગવાનનું લાંછન (ચિહ્ન) શું છે?",
        answer: "ઘોડો (અશ્વ)",
        hints: h("તે દોડવામાં ખૂબ ઝડપી પ્રાણી છે.", "તેનો ઉપયોગ સવારી માટે થાય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી સંભવનાથ ભગવાનનું જન્મ સ્થળ કયું હતું?",
        answer: "શ્રાવસ્તી",
        hints: h("આ ઉત્તર પ્રદેશમાં આવેલ એક પ્રાચીન નગરી છે.", "તેનું નામ 'શ્રા' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી સંભવનાથ ભગવાન કયા ક્રમના તીર્થંકર છે?",
        answer: "ત્રીજા",
        hints: h("શ્રી અજિતનાથ ભગવાન પછી આવે છે.", "તેમનો ક્રમ ૩ છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી સંભવનાથ ભગવાનના શરીરનો વર્ણ કયો હતો?",
        answer: "સુવર્ણ (પીળો)",
        hints: h("તેમના શરીરનો રંગ સોના જેવો હતો.", "પ્રથમ પાંચ તીર્થંકરોનો સમાન વર્ણ."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી સંભવનાથ ભગવાનનું નિર્વાણ (મોક્ષ) સ્થળ કયું છે?",
        answer: "સમ્મેદ શિખર",
        hints: h("આ ઝારખંડમાં આવેલ પવિત્ર પર્વત છે.", "તેને 'પારસનાથ પહાડ' પણ કહેવાય છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી સંભવનાથ ભગવાન કયા વંશમાં જન્મ્યા હતા?",
        answer: "ઇક્ષ્વાકુ વંશ",
        hints: h("પ્રથમ પાંચ તીર્થંકરોનો સામાન્ય વંશ.", "શ્રી આદિનાથ ભગવાનનો પણ આ જ વંશ હતો."),
      },
      {
        difficulty: "HARD",
        question: "શ્રી સંભવનાથ ભગવાનના પિતા જિતારિ કઈ નગરીના રાજા હતા?",
        answer: "શ્રાવસ્તી",
        hints: h("સંભવનાથ ભગવાનનું જન્મસ્થળ પણ આ જ નગરી હતી.", "તેનું નામ 'શ્રા' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "HARD",
        question: "પરંપરા મુજબ શ્રી સંભવનાથ ભગવાનનું આયુષ્ય કેટલા 'લાખ પૂર્વ' હતું?",
        answer: "૬૦ લાખ પૂર્વ",
        hints: h("તે ૫૦ થી વધુ અને ૭૦ થી ઓછું લાખ પૂર્વ છે.", "તે સાઠ (૬૦) લાખ પૂર્વ છે."),
      },
    ],
  },
  {
    title: "શ્રી અભિનંદન સ્વામી ભગવાન જીવન ચરિત્ર",
    description: "ચોથા તીર્થંકર શ્રી અભિનંદન સ્વામી ભગવાનના જીવન વિશે પ્રશ્નો.",
    specificTag: "અભિનંદન સ્વામી",
    mcq: false,
    questions: [
      {
        difficulty: "EASY",
        question: "શ્રી અભિનંદન સ્વામી ભગવાનના પિતાનું નામ શું હતું?",
        answer: "સંવર",
        hints: h("તેમનું નામ 'સં' અક્ષરથી શરૂ થાય છે.", "તેઓ સંવર રાજા તરીકે ઓળખાતા."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી અભિનંદન સ્વામી ભગવાનની માતાનું નામ શું હતું?",
        answer: "સિદ્ધાર્થા",
        hints: h("ભગવાન મહાવીરના પિતાનું નામ (સિદ્ધાર્થ) આ સાથે મળતું આવે છે.", "તેમનું નામ 'સિ' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી અભિનંદન સ્વામી ભગવાનનું લાંછન (ચિહ્ન) શું છે?",
        answer: "વાંદરો (કપિ)",
        hints: h("તે ઝાડ પર કૂદકા મારતું પ્રાણી છે.", "હનુમાનજી સાથે જોડાયેલ પ્રાણી."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી અભિનંદન સ્વામી ભગવાનનું જન્મ સ્થળ કયું હતું?",
        answer: "અયોધ્યા",
        hints: h("શ્રી આદિનાથ અને અજિતનાથ ભગવાનની પણ આ જ નગરી હતી.", "તેનું નામ 'અ' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી અભિનંદન સ્વામી ભગવાન કયા ક્રમના તીર્થંકર છે?",
        answer: "ચોથા",
        hints: h("શ્રી સંભવનાથ ભગવાન પછી આવે છે.", "તેમનો ક્રમ ૪ છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી અભિનંદન સ્વામી ભગવાનના શરીરનો વર્ણ કયો હતો?",
        answer: "સુવર્ણ (પીળો)",
        hints: h("તેમના શરીરનો રંગ સોના જેવો હતો.", "પ્રથમ પાંચ તીર્થંકરોનો સમાન વર્ણ."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી અભિનંદન સ્વામી ભગવાનનું નિર્વાણ (મોક્ષ) સ્થળ કયું છે?",
        answer: "સમ્મેદ શિખર",
        hints: h("આ ઝારખંડમાં આવેલ પવિત્ર પર્વત છે.", "તેને 'પારસનાથ પહાડ' પણ કહેવાય છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "'અભિનંદન' નામ કયા ભાવ સાથે જોડાયેલ છે?",
        answer: "આનંદ / અભિનંદન (ખુશી)",
        hints: h("આ શબ્દ ખુશી અને હર્ષ સાથે જોડાયેલ છે.", "અંગ્રેજીમાં તેને 'Congratulations' કહેવાય."),
      },
      {
        difficulty: "HARD",
        question: "શ્રી અભિનંદન સ્વામી ભગવાનના પિતા સંવર કઈ નગરીના રાજા હતા?",
        answer: "અયોધ્યા",
        hints: h("અભિનંદન સ્વામીનું જન્મસ્થળ પણ આ જ નગરી હતી.", "તેનું નામ 'અ' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "HARD",
        question: "પરંપરા મુજબ શ્રી અભિનંદન સ્વામી ભગવાનનું આયુષ્ય કેટલા 'લાખ પૂર્વ' હતું?",
        answer: "૫૦ લાખ પૂર્વ",
        hints: h("તે ૪૦ થી વધુ અને ૬૦ થી ઓછું લાખ પૂર્વ છે.", "તે પચાસ (૫૦) લાખ પૂર્વ છે."),
      },
    ],
  },
  {
    title: "શ્રી સુમતિનાથ ભગવાન જીવન ચરિત્ર",
    description: "પાંચમા તીર્થંકર શ્રી સુમતિનાથ ભગવાનના જીવન વિશે પ્રશ્નો.",
    specificTag: "સુમતિનાથ",
    mcq: false,
    questions: [
      {
        difficulty: "EASY",
        question: "શ્રી સુમતિનાથ ભગવાનના પિતાનું નામ શું હતું?",
        answer: "મેઘ (મેઘરાજા)",
        hints: h("તેમનું નામ વરસાદ/વાદળ સાથે જોડાયેલ છે.", "તેમનું નામ 'મે' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી સુમતિનાથ ભગવાનની માતાનું નામ શું હતું?",
        answer: "મંગલા (સુમંગલા)",
        hints: h("તેમનું નામ શુભ-મંગલ સાથે જોડાયેલ છે.", "તેમનું નામ 'મં' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી સુમતિનાથ ભગવાનનું લાંછન (ચિહ્ન) શું છે?",
        answer: "ક્રૌંચ પક્ષી",
        hints: h("તે એક પક્ષી છે.", "તે બગલા જેવું જળચર પક્ષી (ક્રૌંચ) છે."),
      },
      {
        difficulty: "EASY",
        question: "શ્રી સુમતિનાથ ભગવાનનું જન્મ સ્થળ કયું હતું?",
        answer: "અયોધ્યા",
        hints: h("શ્રી આદિનાથ ભગવાનની પણ આ જ નગરી હતી.", "તેનું નામ 'અ' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી સુમતિનાથ ભગવાન કયા ક્રમના તીર્થંકર છે?",
        answer: "પાંચમા",
        hints: h("શ્રી અભિનંદન સ્વામી ભગવાન પછી આવે છે.", "તેમનો ક્રમ ૫ છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી સુમતિનાથ ભગવાનના શરીરનો વર્ણ કયો હતો?",
        answer: "સુવર્ણ (પીળો)",
        hints: h("તેમના શરીરનો રંગ સોના જેવો હતો.", "પ્રથમ પાંચ તીર્થંકરોનો સમાન વર્ણ."),
      },
      {
        difficulty: "MEDIUM",
        question: "શ્રી સુમતિનાથ ભગવાનનું નિર્વાણ (મોક્ષ) સ્થળ કયું છે?",
        answer: "સમ્મેદ શિખર",
        hints: h("આ ઝારખંડમાં આવેલ પવિત્ર પર્વત છે.", "તેને 'પારસનાથ પહાડ' પણ કહેવાય છે."),
      },
      {
        difficulty: "MEDIUM",
        question: "'સુમતિ' નામનો અર્થ શું થાય છે?",
        answer: "સારી બુદ્ધિ / શ્રેષ્ઠ મતિ",
        hints: h("આ શબ્દ 'સુ + મતિ' થી બન્યો છે.", "એટલે કે સદ્‌બુદ્ધિ — સારી સમજણ."),
      },
      {
        difficulty: "HARD",
        question: "શ્રી સુમતિનાથ ભગવાનના પિતા મેઘરાજા કઈ નગરીના રાજા હતા?",
        answer: "અયોધ્યા",
        hints: h("સુમતિનાથ ભગવાનનું જન્મસ્થળ પણ આ જ નગરી હતી.", "તેનું નામ 'અ' અક્ષરથી શરૂ થાય છે."),
      },
      {
        difficulty: "HARD",
        question: "પરંપરા મુજબ શ્રી સુમતિનાથ ભગવાનનું આયુષ્ય કેટલા 'લાખ પૂર્વ' હતું?",
        answer: "૪૦ લાખ પૂર્વ",
        hints: h("તે ૩૦ થી વધુ અને ૫૦ થી ઓછું લાખ પૂર્વ છે.", "તે ચાળીસ (૪૦) લાખ પૂર્વ છે."),
      },
    ],
  },
];

/* ─────────────── seed ─────────────── */

async function main() {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const c = {
    users: db.collection("users"),
    questions: db.collection("questions"),
    rounds: db.collection("rounds"),
  };

  // Owner: prefer OWNER_EMAIL, then "admin", then first ADMIN, then first user.
  const preferredEmail = process.env.OWNER_EMAIL ?? "admin";
  const owner =
    (await c.users.findOne({ email: preferredEmail })) ??
    (await c.users.findOne({ role: "ADMIN" })) ??
    (await c.users.findOne({}));
  if (!owner) throw new Error("No user found to own the seed content. Create an account first.");
  const ownerId = owner._id;

  // Idempotency: remove any prior copy of this exact seed, then re-insert.
  const roundTitles = ROUNDS.map((r) => r.title);
  await c.questions.deleteMany({ ownerId, hostNotes: SEED_MARKER });
  await c.rounds.deleteMany({ ownerId, title: { $in: roundTitles } });

  const exportRounds = [];
  let totalQuestions = 0;
  let mcqQuestions = 0;

  for (const round of ROUNDS) {
    const tags = [...BASE_TAGS, round.specificTag];
    const questionDocs = round.questions.map((q) => ({
      _id: oid(),
      ownerId,
      type: "TEXT",
      question: q.question,
      mediaUrl: undefined,
      media: null,
      isMCQ: Boolean(round.mcq),
      options: round.mcq ? q.options : [],
      answer: q.answer,
      explanation: undefined,
      hints: q.hints,
      hostNotes: SEED_MARKER,
      scoringMode: "CUSTOM",
      timerMode: "CUSTOM",
      timer: 30,
      positiveMarks: 10,
      negativeMarks: 5,
      bonusMarks: 0,
      coinReward: 0,
      difficulty: q.difficulty,
      tags,
      createdAt: now(),
      updatedAt: now(),
    }));
    await c.questions.insertMany(questionDocs);
    totalQuestions += questionDocs.length;
    if (round.mcq) mcqQuestions += questionDocs.length;

    const roundDoc = {
      _id: oid(),
      ownerId,
      title: round.title,
      description: round.description,
      rules: "દરેક પ્રશ્નનો સાચો જવાબ +૧૦ ગુણ, ખોટો જવાબ -૫ ગુણ. સમય: ૩૦ સેકન્ડ. હિન્ટ લેવાથી ગુણ ઓછા થઈ શકે.",
      category: "Knowledge",
      roundType: "QUESTION_ANSWER",
      specialMode: "NONE",
      questions: questionDocs.map((q) => q._id), // ordered attachment
      scoringMode: "CUSTOM",
      defaultTimer: 30,
      positiveMarks: 10,
      negativeMarks: 5,
      bonusMarks: 0,
      coinReward: 0,
      questionAssignment: "DEFAULT",
      powerCardMode: "DEFAULT",
      allowedPowerCards: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await c.rounds.insertOne(roundDoc);

    // Build the requested import-format export.
    exportRounds.push({
      roundName: round.title,
      questionType: round.mcq ? "MCQ" : "QUESTION_HINT",
      questions: round.questions.map((q) => ({
        roundName: round.title,
        questionType: round.mcq ? "MCQ" : "QUESTION_HINT",
        questionText: q.question,
        ...(round.mcq ? { options: q.options } : {}),
        correctAnswer: q.answer,
        hints: q.hints.map((hint) => hint.text),
        difficulty: q.difficulty,
        points: { correct: 10, wrong: -5 },
        timer: 30,
        tags: [...BASE_TAGS, round.specificTag],
      })),
    });
  }

  // Write the JSON export in the requested import format.
  const exportPath = path.join("scripts", "jain-tirthankar-content.json");
  fs.writeFileSync(exportPath, JSON.stringify({ rounds: exportRounds }, null, 2), "utf8");

  /* ─────────────── verification ─────────────── */
  const checks = [];
  const check = (label, ok) => {
    checks.push(`${ok ? "PASS" : "FAIL"} ${label}`);
    if (!ok) throw new Error(`Verification failed: ${label}`);
  };

  const seededQuestions = await c.questions.find({ ownerId, hostNotes: SEED_MARKER }).toArray();
  const seededRounds = await c.rounds.find({ ownerId, title: { $in: roundTitles } }).toArray();

  check("Total rounds = 5", seededRounds.length === 5);
  check("Total questions = 50", seededQuestions.length === 50);
  check("Each round has exactly 10 attached questions", seededRounds.every((r) => r.questions.length === 10));

  const gujarati = /[઀-૿]/; // Gujarati Unicode block
  check("All answers are Gujarati", seededQuestions.every((q) => gujarati.test(q.answer)));
  check("All questions have >= 2 Gujarati hints", seededQuestions.every((q) => q.hints.length >= 2 && q.hints.every((hint) => gujarati.test(hint.text))));
  check("All question text is Gujarati (no English content)", seededQuestions.every((q) => gujarati.test(q.question) && !/[a-zA-Z]{3,}/.test(q.question)));

  const round1 = seededRounds.find((r) => r.title === ROUNDS[0].title);
  const round2 = seededRounds.find((r) => r.title === ROUNDS[1].title);
  const r1q = seededQuestions.filter((q) => round1.questions.some((id) => id.equals(q._id)));
  const r2q = seededQuestions.filter((q) => round2.questions.some((id) => id.equals(q._id)));
  check("Round 1 options exist (MCQ, 4 options each)", r1q.length === 10 && r1q.every((q) => q.isMCQ && q.options.length === 4 && q.options.includes(q.answer)));
  check("Round 2 options exist (MCQ, 4 options each)", r2q.length === 10 && r2q.every((q) => q.isMCQ && q.options.length === 4 && q.options.includes(q.answer)));
  check("Rounds 3–5 have no options (question + hint only)", seededQuestions.filter((q) => !r1q.includes(q) && !r2q.includes(q)).every((q) => !q.isMCQ && q.options.length === 0));

  // Difficulty mix per round: 4 EASY, 4 MEDIUM, 2 HARD.
  for (const r of seededRounds) {
    const qs = seededQuestions.filter((q) => r.questions.some((id) => id.equals(q._id)));
    const count = (d) => qs.filter((q) => q.difficulty === d).length;
    check(`Round "${r.title}" difficulty mix 4/4/2`, count("EASY") === 4 && count("MEDIUM") === 4 && count("HARD") === 2);
  }

  check("MCQ questions total = 20 (rounds 1 & 2)", mcqQuestions === 20);
  check("Points +10 / -5 and timer 30 on every question", seededQuestions.every((q) => q.positiveMarks === 10 && q.negativeMarks === 5 && q.timer === 30));

  console.log(
    JSON.stringify(
      {
        owner: { email: owner.email, name: owner.name, role: owner.role },
        rounds: seededRounds.length,
        questions: seededQuestions.length,
        mcqQuestions,
        exportFile: exportPath,
        checks,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("SEED FAILED:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

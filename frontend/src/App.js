import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "@/App.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import CalendarPage from "@/pages/Calendar";
import CalendarComparePage from "@/pages/CalendarCompare";
import WellbeingPage from "@/pages/Wellbeing";
import PlantsPage from "@/pages/Plants";
import PlantDetailPage from "@/pages/PlantDetail";
import RegrowFromScrapsPage from "@/pages/RegrowFromScraps";
import CutFlowersPage from "@/pages/CutFlowers";
import GrowAnywherePage from "@/pages/GrowAnywhere";
import RecipesPage from "@/pages/Recipes";
import BouquetPage from "@/pages/Bouquet";
import PestControlPage from "@/pages/PestControl";
import MyGardenPage from "@/pages/MyGarden";
import GuidesPage from "@/pages/Guides";
import PrintPage from "@/pages/Print";
import MasterclassesPage from "@/pages/Masterclasses";
import MasterclassDetailPage from "@/pages/MasterclassDetail";
import AIMasterclassPage from "@/pages/AIMasterclass";
import LearnLandingPage from "@/pages/LearnLanding";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import AdminAiUsagePage from "@/pages/AdminAiUsage";
import AdminReferralsPage from "@/pages/AdminReferrals";
import AdminAiSearchesPage from "@/pages/AdminAiSearches";
import AdminGeoPage from "@/pages/AdminGeo";
import AdminHomePage from "@/pages/AdminHome";
import PatronsPage from "@/pages/Patrons";
import PatronsManagePage from "@/pages/PatronsManage";
import SharedPatchPage from "@/pages/SharedPatch";
import EmbedPatchPage from "@/pages/EmbedPatch";
import PrivacyPage from "@/pages/Privacy";
import TermsPage from "@/pages/Terms";
import AboutPage from "@/pages/About";
import RevenuePage from "@/pages/Revenue";
import AskPage from "@/pages/Ask";
import LanguageDetectedBanner from "@/components/LanguageDetectedBanner";
import { useReferralCapture } from "@/hooks/useReferralCapture";

export default function App() {
  useReferralCapture();
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

/**
 * Embed routes (e.g. /embed/p/:shareId) are designed to be dropped inside a
 * 3rd-party iframe on a blog or club site, so they MUST skip our brand
 * Header/Footer chrome — the host page already has its own. Every other
 * route renders the full shell.
 */
function AppShell() {
  const location = useLocation();
  const isEmbed = location.pathname.startsWith("/embed/");

  if (isEmbed) {
    return (
      <Routes>
        <Route path="/embed/p/:shareId" element={<EmbedPatchPage />} />
      </Routes>
    );
  }

  return (
    <div className="page-shell">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/calendar/compare" element={<CalendarComparePage />} />
          <Route path="/wellbeing" element={<WellbeingPage />} />
          <Route path="/plants" element={<PlantsPage />} />
          <Route path="/plants/ai/:slug" element={<PlantDetailPage />} />
          <Route path="/plants/:id" element={<PlantDetailPage />} />
          <Route path="/regrow-from-scraps" element={<RegrowFromScrapsPage />} />
          <Route path="/cut-flowers" element={<CutFlowersPage />} />
          <Route path="/grow-anywhere" element={<GrowAnywherePage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/bouquet" element={<BouquetPage />} />
          <Route path="/pests" element={<PestControlPage />} />
          <Route path="/garden" element={<MyGardenPage />} />
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/guides/:slug" element={<GuidesPage />} />
          <Route path="/masterclasses" element={<MasterclassesPage />} />
          <Route path="/masterclasses/custom/:slug" element={<AIMasterclassPage />} />
          <Route path="/masterclasses/custom/:slug/:lessonSlug" element={<AIMasterclassPage />} />
          <Route path="/masterclasses/:slug" element={<MasterclassDetailPage />} />
          <Route path="/masterclasses/:slug/:lessonSlug" element={<MasterclassDetailPage />} />
          <Route path="/learn/:topic" element={<LearnLandingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admin" element={<AdminHomePage />} />
          <Route path="/admin/revenue" element={<RevenuePage />} />
          <Route path="/ask" element={<AskPage />} />
          <Route path="/print/:month" element={<PrintPage />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/checkout/cancel" element={<Home />} />
          <Route path="/admin/ai-usage" element={<AdminAiUsagePage />} />
          <Route path="/admin/ai-searches" element={<AdminAiSearchesPage />} />
          <Route path="/admin/referrals" element={<AdminReferralsPage />} />
          <Route path="/admin/geo" element={<AdminGeoPage />} />
          <Route path="/patrons" element={<PatronsPage />} />
          <Route path="/patrons/manage" element={<PatronsManagePage />} />
          <Route path="/p/:shareId" element={<SharedPatchPage />} />
        </Routes>
      </main>
      <Footer />
      <LanguageDetectedBanner />
    </div>
  );
}

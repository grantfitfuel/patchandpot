import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import CalendarPage from "@/pages/Calendar";
import PlantsPage from "@/pages/Plants";
import PlantDetailPage from "@/pages/PlantDetail";
import AIPlantDetailPage from "@/pages/AIPlantDetail";
import PestControlPage from "@/pages/PestControl";
import MyGardenPage from "@/pages/MyGarden";
import GuidesPage from "@/pages/Guides";
import PrintPage from "@/pages/Print";
import MasterclassesPage from "@/pages/Masterclasses";
import MasterclassDetailPage from "@/pages/MasterclassDetail";
import AIMasterclassPage from "@/pages/AIMasterclass";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import LanguageDetectedBanner from "@/components/LanguageDetectedBanner";

export default function App() {
  return (
    <BrowserRouter>
      <div className="page-shell">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/plants" element={<PlantsPage />} />
            <Route path="/plants/ai/:slug" element={<AIPlantDetailPage />} />
            <Route path="/plants/:id" element={<PlantDetailPage />} />
            <Route path="/pests" element={<PestControlPage />} />
            <Route path="/garden" element={<MyGardenPage />} />
            <Route path="/guides" element={<GuidesPage />} />
            <Route path="/guides/:slug" element={<GuidesPage />} />
            <Route path="/masterclasses" element={<MasterclassesPage />} />
            <Route path="/masterclasses/custom/:slug" element={<AIMasterclassPage />} />
            <Route path="/masterclasses/custom/:slug/:lessonSlug" element={<AIMasterclassPage />} />
            <Route path="/masterclasses/:slug" element={<MasterclassDetailPage />} />
            <Route path="/masterclasses/:slug/:lessonSlug" element={<MasterclassDetailPage />} />
            <Route path="/print/:month" element={<PrintPage />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/cancel" element={<Home />} />
          </Routes>
        </main>
        <Footer />
        <LanguageDetectedBanner />
      </div>
    </BrowserRouter>
  );
}

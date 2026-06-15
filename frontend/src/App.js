import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import CalendarPage from "@/pages/Calendar";
import PlantsPage from "@/pages/Plants";
import PlantDetailPage from "@/pages/PlantDetail";
import PestControlPage from "@/pages/PestControl";
import MyGardenPage from "@/pages/MyGarden";
import GuidesPage from "@/pages/Guides";
import PrintPage from "@/pages/Print";
import MasterclassesPage from "@/pages/Masterclasses";
import MasterclassDetailPage from "@/pages/MasterclassDetail";

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
            <Route path="/plants/:id" element={<PlantDetailPage />} />
            <Route path="/pests" element={<PestControlPage />} />
            <Route path="/garden" element={<MyGardenPage />} />
            <Route path="/guides" element={<GuidesPage />} />
            <Route path="/guides/:slug" element={<GuidesPage />} />
            <Route path="/masterclasses" element={<MasterclassesPage />} />
            <Route path="/masterclasses/:slug" element={<MasterclassDetailPage />} />
            <Route path="/masterclasses/:slug/:lessonSlug" element={<MasterclassDetailPage />} />
            <Route path="/print/:month" element={<PrintPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

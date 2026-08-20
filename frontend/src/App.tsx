import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAdmin from './components/RequireAdmin.tsx';
import RequireAuth from './components/RequireAuth.tsx';
import { AdminIndex, default as AdminZone } from './pages/AdminZone.tsx';
import AppZone from './pages/AppZone.tsx';
import ArticleDetailPage from './pages/ArticleDetailPage.tsx';
import ArticlesPage from './pages/ArticlesPage.tsx';
import ContactPage from './pages/ContactPage.tsx';
import DownloadsPage from './pages/DownloadsPage.tsx';
import HomePage from './pages/HomePage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import AdminArticleEditorPage from './pages/admin/AdminArticleEditorPage.tsx';
import AdminArticlesPage from './pages/admin/AdminArticlesPage.tsx';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage.tsx';
import AdminContactPage from './pages/admin/AdminContactPage.tsx';
import AdminDownloadsPage from './pages/admin/AdminDownloadsPage.tsx';
import AdminTagsPage from './pages/admin/AdminTagsPage.tsx';
import AdminUsersPage from './pages/admin/AdminUsersPage.tsx';
import MediaImagesPage from './pages/admin/MediaImagesPage.tsx';
import MediaVideosPage from './pages/admin/MediaVideosPage.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppZone />
          </RequireAuth>
        }
      >
        <Route path="articles" element={<ArticlesPage />} />
        <Route path="articles/:slug" element={<ArticleDetailPage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="contact" element={<ContactPage />} />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminZone />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminIndex />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="articles" element={<AdminArticlesPage />} />
        <Route path="articles/new" element={<AdminArticleEditorPage />} />
        <Route path="articles/:id/edit" element={<AdminArticleEditorPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="tags" element={<AdminTagsPage />} />
        <Route path="images" element={<MediaImagesPage />} />
        <Route path="videos" element={<MediaVideosPage />} />
        <Route path="downloads" element={<AdminDownloadsPage />} />
        <Route path="contact" element={<AdminContactPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

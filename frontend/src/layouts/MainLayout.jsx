import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function MainLayout({ children }) {
  return (
    <div className="main-shell">
      <Sidebar />
      <div className="main-area">
        <Navbar />
        {children}
      </div>
    </div>
  );
}

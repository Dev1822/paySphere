import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Button from "../components/common/Button";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-['Outfit'] text-[#1A1A1A] dark:text-slate-100 flex flex-col items-center justify-center transition-colors duration-200">
      <Helmet>
        <title>404 Not Found | PaySphere</title>
        <meta name="description" content="The page you are looking for does not exist." />
      </Helmet>
      
      <div className="text-center p-8 max-w-lg">
        <h1 className="text-9xl font-bold text-blue-600 mb-4">404</h1>
        <h2 className="text-3xl font-semibold mb-6">Page Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex gap-4 justify-center">
          <Button 
            onClick={() => navigate("/")} 
            variant="contained" 
            color="primary"
            className="px-8 py-3 rounded-full"
          >
            Back to Home
          </Button>
          <Button 
            onClick={() => navigate(-1)} 
            variant="outlined" 
            color="primary"
            className="px-8 py-3 rounded-full dark:border-blue-500 dark:text-blue-400"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

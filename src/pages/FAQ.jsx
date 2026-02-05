import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * FAQ page - redirects to Help Center with FAQ tab selected
 * This provides a dedicated /faq URL for SEO/crawlability
 */
export default function FAQ() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to Help page with FAQ tab
    navigate(`${createPageUrl("Help")}?tab=faq`, { replace: true });
  }, [navigate]);

  // Show nothing during redirect
  return null;
}
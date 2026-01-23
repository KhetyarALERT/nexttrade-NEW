// Redirect old /Invite page to the unified Rewards Hub
export default function Invite() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to Rewards page with referrals tab active
    navigate(createPageUrl("Rewards") + "?tab=referrals", { replace: true });
  }, [navigate]);

  return null;
}

Invite.propTypes = {};
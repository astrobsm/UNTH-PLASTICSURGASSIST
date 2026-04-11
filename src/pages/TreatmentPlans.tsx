import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function TreatmentPlans() {
  const navigate = useNavigate();
  const { id, planId } = useParams();
  
  useEffect(() => {
    // Redirect to the new Treatment Plan Manager
    if (planId) {
      navigate(`/treatment-plan-manager?planId=${planId}`, { replace: true });
    } else {
      navigate('/treatment-plan-manager', { replace: true });
    }
  }, [navigate, planId]);
  
  return null;
}
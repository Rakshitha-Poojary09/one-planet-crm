import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import { SignaturePad } from '../components/SignaturePad';
import {
  FiArrowLeft,
  FiBookOpen,
  FiFileText,
  FiFile,
  FiExternalLink,
  FiCheckCircle,
  FiAlertTriangle,
  FiRefreshCw,
  FiShield,
  FiEdit2,
  FiMessageSquare,
  FiSend,
  FiTag,
  FiCalendar,
  FiLock,
  FiCheck,
  FiClock,
  FiCornerDownRight,
  FiHelpCircle,
  FiRotateCcw,
  FiUser,
  FiUsers,
  FiDownload,
  FiBell,
  FiEye,
  FiX,
  FiFilter,
  FiSearch,
} from 'react-icons/fi';

export const PolicyViewAcknowledgePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetQuestionId = searchParams.get('questionId');
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  // Core Policy State
  const [policy, setPolicy] = useState(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [policyError, setPolicyError] = useState(null); // { type: '404' | '403' | '500', message: '' }

  // PDF Viewer State
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [signedPdfBlobUrl, setSignedPdfBlobUrl] = useState(null);
  const [showingSignedPdf, setShowingSignedPdf] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [downloadingSignedPdf, setDownloadingSignedPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // Employee Acknowledgement State (Employee only)
  const [hasAgreedCheckbox, setHasAgreedCheckbox] = useState(false);
  const [signatureData, setSignatureData] = useState({ hasSignature: false, dataUrl: '' });
  const [submittingAck, setSubmittingAck] = useState(false);

  // Admin Management Report State (Admin only)
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState('All'); // All, Acknowledged, Opened, Not Opened
  const [reportDeptFilter, setReportDeptFilter] = useState('All');
  const [reportSearch, setReportSearch] = useState('');
  const [inspectingSignature, setInspectingSignature] = useState(null); // Employee signature modal
  const [inspectingSignedPdf, setInspectingSignedPdf] = useState(null); // Employee signed PDF preview modal (Admin)

  // Questions State
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [newQuestionTitle, setNewQuestionTitle] = useState('');
  const [newQuestionMessage, setNewQuestionMessage] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [followUpTexts, setFollowUpTexts] = useState({});
  const [submittingReplyId, setSubmittingReplyId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Revoke Object URLs on unmount
  const pdfBlobUrlRef = useRef(null);
  const signedPdfBlobUrlRef = useRef(null);
  useEffect(() => {
    pdfBlobUrlRef.current = pdfBlobUrl;
  }, [pdfBlobUrl]);
  useEffect(() => {
    signedPdfBlobUrlRef.current = signedPdfBlobUrl;
  }, [signedPdfBlobUrl]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
      }
      if (signedPdfBlobUrlRef.current) {
        URL.revokeObjectURL(signedPdfBlobUrlRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 1. Fetch Policy by ID & Record Access Tracking
  // ---------------------------------------------------------------------------
  const fetchPolicyDetails = useCallback(async () => {
    if (!id) {
      setPolicyError({
        type: '404',
        message: 'No policy ID provided in the URL.',
      });
      setLoadingPolicy(false);
      return;
    }

    try {
      setLoadingPolicy(true);
      setPolicyError(null);

      const res = await api.get(`/policies/${id}`);
      if (res.data?.success && res.data?.policy) {
        const fetchedPolicy = res.data.policy;
        setPolicy(fetchedPolicy);

        // Record document open access in background (if employee)
        if (!isAdmin) {
          try {
            await api.post(`/policies/${id}/track-open`);
          } catch (trackErr) {
            console.warn('[PolicyView] Access tracking ping error:', trackErr);
          }
        }

        // If policy has PDF, fetch authenticated stream
        if (fetchedPolicy.hasPdf) {
          loadPdfDocument(id);
        }

        // Fetch questions for this policy
        loadPolicyQuestions(id);

        // If Admin, load acknowledgement report & stats
        if (isAdmin) {
          fetchPolicyReport(id);
        }
      } else {
        setPolicyError({
          type: '404',
          message: 'The requested policy could not be found.',
        });
      }
    } catch (err) {
      console.error('[PolicyView] Error fetching policy:', err);
      const statusCode = err.response?.status;
      const errorMsg =
        err.response?.data?.message || 'Unable to retrieve company policy at this time.';

      if (statusCode === 404) {
        setPolicyError({ type: '404', message: errorMsg });
      } else if (statusCode === 403) {
        setPolicyError({
          type: '403',
          message:
            errorMsg ||
            'Access denied. You do not have permission to view this policy document.',
        });
      } else {
        setPolicyError({
          type: '500',
          message:
            errorMsg || 'A server error occurred while loading this policy. Please retry.',
        });
      }
    } finally {
      setLoadingPolicy(false);
    }
  }, [id, isAdmin]);

  useEffect(() => {
    fetchPolicyDetails();
  }, [fetchPolicyDetails]);

  // Scroll to question if targetQuestionId query parameter is provided
  useEffect(() => {
    if (targetQuestionId && questions.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`question-${targetQuestionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [targetQuestionId, questions]);

  // ---------------------------------------------------------------------------
  // 2. Fetch Secure PDF Document Blob
  // ---------------------------------------------------------------------------
  const loadPdfDocument = async (policyId) => {
    try {
      setLoadingPdf(true);
      setPdfError(null);

      // Revoke previous blob if any
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }

      const response = await api.get(`/policies/${policyId}/pdf`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(objectUrl);
    } catch (err) {
      console.error('[PolicyView] Error loading PDF blob:', err);
      const status = err.response?.status;
      const msg =
        status === 404
          ? 'The PDF document file was not found on the secure storage server.'
          : status === 403
          ? 'You do not have authorization to download or view this PDF.'
          : 'Could not load the attached policy PDF. Please verify your connection and retry.';
      setPdfError(msg);
    } finally {
      setLoadingPdf(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2b. Load Employee's Individual Signed PDF Document Blob
  // ---------------------------------------------------------------------------
  const loadSignedPdfDocument = async (policyId) => {
    try {
      if (signedPdfBlobUrl) {
        URL.revokeObjectURL(signedPdfBlobUrl);
        setSignedPdfBlobUrl(null);
      }
      const response = await api.get(`/policies/${policyId}/signed-pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      setSignedPdfBlobUrl(objectUrl);
      return objectUrl;
    } catch (err) {
      console.warn('[PolicyView] Signed PDF not yet generated or available:', err?.message);
      return null;
    }
  };

  // Download Signed PDF (Employee for own document, or Admin for employee)
  const handleDownloadSignedPdf = async (targetUserId = null, suggestedName = null) => {
    if (!policy) return;
    try {
      setDownloadingSignedPdf(true);
      const url = targetUserId && isAdmin
        ? `/policies/${policy._id}/signed-pdf/${targetUserId}?download=true`
        : `/policies/${policy._id}/signed-pdf?download=true`;

      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      const downloadName = suggestedName || `${(policy.title || 'Policy').replace(/[^a-zA-Z0-9]/g, '_')}_Signed.pdf`;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast.success('Signed PDF document downloaded successfully.');
    } catch (err) {
      console.error('[PolicyView] Error downloading signed PDF:', err);
      toast.error(err.response?.data?.message || 'Could not download signed PDF.');
    } finally {
      setDownloadingSignedPdf(false);
    }
  };

  // Toggle Signed PDF Preview in main PDF viewer iframe
  const handleToggleSignedPdfPreview = async () => {
    if (showingSignedPdf) {
      setShowingSignedPdf(false);
      return;
    }

    try {
      setLoadingPdf(true);
      let targetUrl = signedPdfBlobUrl;
      if (!targetUrl) {
        targetUrl = await loadSignedPdfDocument(policy._id);
      }
      if (targetUrl) {
        setShowingSignedPdf(true);
      } else {
        toast.warning('Signed PDF is being finalized. Please retry in a moment.');
      }
    } catch (err) {
      toast.error('Unable to load signed PDF preview.');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Admin View Signed PDF in Modal
  const handleAdminViewSignedPdf = async (reportItem) => {
    try {
      setInspectingSignedPdf({
        user: reportItem.user,
        status: reportItem.status,
        acknowledgedAt: reportItem.acknowledgedAt,
        loading: true,
        blobUrl: null,
        fileName: reportItem.signedPdf?.fileName || `${policy.title}_${reportItem.user.fullName}_Signed.pdf`,
      });

      const res = await api.get(`/policies/${policy._id}/signed-pdf/${reportItem.user._id}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const objUrl = URL.createObjectURL(blob);

      setInspectingSignedPdf((prev) => ({
        ...prev,
        loading: false,
        blobUrl: objUrl,
      }));
    } catch (err) {
      console.error('Error opening signed PDF preview:', err);
      toast.error(err.response?.data?.message || 'Failed to retrieve employee signed PDF.');
      setInspectingSignedPdf(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. Admin: Fetch Acknowledgement Report & Stats
  // ---------------------------------------------------------------------------
  const fetchPolicyReport = async (policyId) => {
    try {
      setLoadingReport(true);
      const res = await api.get(`/policies/${policyId}/report`);
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('[PolicyView] Error loading report:', err);
      toast.error('Failed to load employee acknowledgement report.');
    } finally {
      setLoadingReport(false);
    }
  };

  // Admin: Send Policy Reminders to Pending Employees
  const handleSendReminder = async () => {
    if (!policy) return;
    try {
      setSendingReminder(true);
      const res = await api.post(`/policies/${policy._id}/send-reminder`);
      if (res.data?.success) {
        toast.success(res.data.message || 'Acknowledgement reminders sent to pending employees.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reminders.');
    } finally {
      setSendingReminder(false);
    }
  };

  // Admin: Export CSV Report
  const handleExportCsv = () => {
    if (!reportData || !reportData.report || reportData.report.length === 0) {
      toast.warning('No acknowledgement records available to export.');
      return;
    }

    const headers = [
      'Employee Name',
      'Employee ID',
      'Department',
      'Role',
      'Status',
      'First Opened',
      'Latest Opened',
      'Acknowledged At',
    ];

    const rows = reportData.report.map((r) => [
      `"${r.user.fullName || ''}"`,
      `"${r.user.employeeId || ''}"`,
      `"${r.user.department || ''}"`,
      `"${r.user.role || ''}"`,
      `"${r.status || ''}"`,
      `"${r.firstOpenedAt ? new Date(r.firstOpenedAt).toLocaleString() : 'Never'}"`,
      `"${r.latestOpenedAt ? new Date(r.latestOpenedAt).toLocaleString() : 'Never'}"`,
      `"${r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleString() : 'Pending'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeTitle = (policy.title || 'Policy').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute(
      'download',
      `Policy_Acknowledgement_Report_${safeTitle}_v${policy.version}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Acknowledgement report exported to CSV successfully.');
  };

  // ---------------------------------------------------------------------------
  // 4. Fetch Questions for Policy
  // ---------------------------------------------------------------------------
  const loadPolicyQuestions = async (policyId) => {
    try {
      setLoadingQuestions(true);
      const res = await api.get(`/policies/${policyId}/questions`);
      if (res.data?.success) {
        setQuestions(res.data.questions || []);
      }
    } catch (err) {
      console.error('[PolicyView] Error loading questions:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. Employee: Submit Acknowledgement with Drawn Signature
  // ---------------------------------------------------------------------------
  const handleSubmitAcknowledgement = async () => {
    if (!hasAgreedCheckbox) {
      toast.warning('Please check the acknowledgement statement before submitting.');
      return;
    }

    if (!signatureData.hasSignature || !signatureData.dataUrl) {
      toast.warning('Please draw your digital signature in the signature pad.');
      return;
    }

    try {
      setSubmittingAck(true);

      const payload = {
        statement:
          'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.',
        signatureImage: signatureData.dataUrl,
        employeeId: user?.employeeId || '',
        employeeName: user?.fullName || '',
        policyVersion: policy.version,
      };

      const res = await api.post(`/policies/${policy._id}/acknowledge`, payload);

      if (res.data?.success) {
        toast.success(res.data.message || 'Policy acknowledged successfully!');

        // Update local state to reflect successful acknowledgement
        setPolicy((prev) => ({
          ...prev,
          isAcknowledged: true,
          statusForUser: 'Acknowledged',
          acknowledgedAt: new Date().toISOString(),
          mySignature: signatureData.dataUrl,
          myStatement: payload.statement,
        }));
      } else {
        toast.error(res.data?.message || 'Failed to record acknowledgement.');
      }
    } catch (err) {
      console.error('[PolicyView] Acknowledgement error:', err);
      toast.error(
        err.response?.data?.message || 'Failed to submit acknowledgement. Please retry.'
      );
    } finally {
      setSubmittingAck(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 6. Submit Employee Question
  // Employees can submit questions even if they have not yet acknowledged the policy
  // ---------------------------------------------------------------------------
  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionMessage.trim()) {
      toast.warning('Please enter your question description or message.');
      return;
    }

    try {
      setSubmittingQuestion(true);
      const res = await api.post(`/policies/${policy._id}/questions`, {
        title: newQuestionTitle.trim() || `Inquiry regarding ${policy.title}`,
        message: newQuestionMessage.trim(),
      });

      if (res.data?.success) {
        toast.success('Your question has been sent to HR / Management.');
        setNewQuestionTitle('');
        setNewQuestionMessage('');
        loadPolicyQuestions(policy._id);
      }
    } catch (err) {
      console.error('[PolicyView] Question submission error:', err);
      toast.error(err.response?.data?.message || 'Failed to submit question.');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. Submit Follow-up Reply or Admin Response
  // ---------------------------------------------------------------------------
  const handleSubmitReply = async (questionId) => {
    const text = followUpTexts[questionId];
    if (!text || !text.trim()) return;

    try {
      setSubmittingReplyId(questionId);
      const res = await api.post(`/policies/${policy._id}/questions/${questionId}/reply`, {
        message: text.trim(),
      });

      if (res.data?.success) {
        toast.success('Reply submitted.');
        setFollowUpTexts((prev) => ({ ...prev, [questionId]: '' }));
        loadPolicyQuestions(policy._id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post reply.');
    } finally {
      setSubmittingReplyId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 8. Admin: Update Question Status (Open, Answered, Resolved)
  // ---------------------------------------------------------------------------
  const handleUpdateStatus = async (questionId, newStatus) => {
    if (!questionId || !newStatus) return;
    try {
      setUpdatingStatusId(questionId);
      // Optimistic UI update
      setQuestions((prev) =>
        prev.map((q) => (q._id === questionId ? { ...q, status: newStatus } : q))
      );

      const endpoint = policy?._id
        ? `/policies/${policy._id}/questions/${questionId}/status`
        : `/policies/questions/${questionId}/status`;

      const res = await api.patch(endpoint, {
        status: newStatus,
      });

      if (res.data?.success) {
        toast.success(`Question status updated to ${newStatus}.`);
        if (policy?._id) loadPolicyQuestions(policy._id);
      } else {
        if (policy?._id) loadPolicyQuestions(policy._id);
      }
    } catch (err) {
      console.error('Error updating question status:', err);
      toast.error(err.response?.data?.message || 'Failed to update question status.');
      if (policy?._id) loadPolicyQuestions(policy._id);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Filtered list for Admin Acknowledgement Report Table
  const filteredReportList = useMemo(() => {
    if (!reportData || !reportData.report) return [];
    return reportData.report.filter((r) => {
      // Status Filter
      if (reportStatusFilter !== 'All' && r.status !== reportStatusFilter) {
        return false;
      }
      // Department Filter
      if (reportDeptFilter !== 'All' && r.user.department !== reportDeptFilter) {
        return false;
      }
      // Search
      if (reportSearch.trim()) {
        const q = reportSearch.trim().toLowerCase();
        const nameMatch = r.user.fullName?.toLowerCase().includes(q);
        const idMatch = r.user.employeeId?.toLowerCase().includes(q);
        const emailMatch = r.user.email?.toLowerCase().includes(q);
        const deptMatch = r.user.department?.toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !emailMatch && !deptMatch) return false;
      }
      return true;
    });
  }, [reportData, reportStatusFilter, reportDeptFilter, reportSearch]);

  // Unique departments for report filter
  const reportDepartments = useMemo(() => {
    if (!reportData || !reportData.report) return [];
    const depts = new Set();
    reportData.report.forEach((r) => {
      if (r.user.department) depts.add(r.user.department);
    });
    return Array.from(depts);
  }, [reportData]);

  // ===========================================================================
  // RENDER: Loading State
  // ===========================================================================
  if (loadingPolicy) {
    return (
      <MainLayout
        title="Company Policy"
        subtitle="Review document guidelines and compliance details."
      >
        <div className="container-fluid py-4">
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-body p-5 text-center">
              <div className="spinner-border text-success mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
                <span className="visually-hidden">Loading policy...</span>
              </div>
              <h5 className="fw-bold text-dark">Loading Policy Document...</h5>
              <p className="text-muted small mb-0">
                Retrieving official document details, distribution parameters, and compliance records.
              </p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ===========================================================================
  // RENDER: Error State (404, 403, 500) - NEVER SHOW A BLANK PAGE
  // ===========================================================================
  if (policyError || !policy) {
    const is404 = policyError?.type === '404';
    const is403 = policyError?.type === '403';

    return (
      <MainLayout
        title="Company Policies"
        subtitle="Policy Document Distribution & Acknowledgement Portal"
      >
        <div className="container-fluid py-4">
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-body p-5 text-center">
              <div
                className={`d-inline-flex p-3 rounded-circle mb-3 ${
                  is404
                    ? 'bg-warning bg-opacity-10 text-warning'
                    : is403
                    ? 'bg-danger bg-opacity-10 text-danger'
                    : 'bg-secondary bg-opacity-10 text-secondary'
                }`}
              >
                {is404 ? (
                  <FiAlertTriangle size={36} />
                ) : is403 ? (
                  <FiLock size={36} />
                ) : (
                  <FiAlertTriangle size={36} />
                )}
              </div>

              <h4 className="fw-bold text-dark mb-2">
                {is404
                  ? 'Policy Document Not Found'
                  : is403
                  ? 'Access Restricted'
                  : 'Unable to Load Policy'}
              </h4>

              <p className="text-muted mb-4 mx-auto" style={{ maxWidth: 540 }}>
                {policyError?.message ||
                  'The requested policy could not be loaded. It may have been archived, unpublished, or your account may not have permission to view it.'}
              </p>

              <div className="d-flex justify-content-center align-items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigate('/policies')}
                  className="btn btn-outline-secondary d-flex align-items-center gap-2"
                >
                  <FiArrowLeft size={16} /> Back to Policies
                </button>

                {!is404 && !is403 && (
                  <button
                    onClick={fetchPolicyDetails}
                    className="btn btn-success d-flex align-items-center gap-2"
                    style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                  >
                    <FiRefreshCw size={15} /> Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const isAcknowledged = policy.statusForUser === 'Acknowledged' || policy.isAcknowledged;
  const stats = reportData?.stats;

  return (
    <MainLayout
      title={policy.title}
      subtitle={
        isAdmin
          ? `Admin Management View • Version ${policy.version} • ${policy.category}`
          : `Policy Version ${policy.version} • ${policy.category}`
      }
    >
      <div className="container-fluid py-3">
        {/* =================================================================== */}
        {/* TOP HEADER: NAVIGATION & POLICY METADATA                            */}
        {/* =================================================================== */}
        <div className="card shadow-sm border-0 rounded-3 mb-4">
          <div className="card-body p-3 p-md-4">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div>
                <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                  <button
                    onClick={() => navigate('/policies')}
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 py-1 px-2.5"
                    style={{ fontSize: '0.8rem' }}
                  >
                    <FiArrowLeft size={14} /> Back to Policies
                  </button>

                  <span className="badge bg-light text-secondary border">
                    <FiTag size={11} className="me-1 text-muted" />
                    {policy.category}
                  </span>

                  <span className="badge bg-dark text-white">
                    Version {policy.version}
                  </span>

                  {policy.hasPdf && (
                    <span className="badge bg-danger bg-opacity-10 text-danger border border-danger">
                      <FiFile size={11} className="me-1" /> PDF Attached
                    </span>
                  )}

                  {/* Status Badge */}
                  {isAdmin ? (
                    <span
                      className={`badge fw-semibold ${
                        policy.status === 'Published'
                          ? 'bg-success bg-opacity-10 text-success border border-success'
                          : policy.status === 'Draft'
                          ? 'bg-warning bg-opacity-10 text-warning border border-warning'
                          : 'bg-secondary bg-opacity-10 text-secondary border'
                      }`}
                    >
                      {policy.status}
                    </span>
                  ) : isAcknowledged ? (
                    <span className="badge bg-success bg-opacity-10 text-success border border-success fw-semibold">
                      <FiCheckCircle size={12} className="me-1" /> Acknowledged
                    </span>
                  ) : (
                    <span className="badge bg-warning bg-opacity-10 text-warning border border-warning fw-semibold">
                      <FiClock size={12} className="me-1" /> Acknowledgement Pending
                    </span>
                  )}

                  {isAdmin && (
                    <span className="badge bg-primary bg-opacity-10 text-primary border border-primary small">
                      <FiShield size={10} className="me-1" /> Admin Management Mode
                    </span>
                  )}
                </div>

                <h3 className="fw-bold text-dark mb-1">{policy.title}</h3>

                <div className="d-flex align-items-center gap-3 text-muted small flex-wrap" style={{ fontSize: '0.8rem' }}>
                  <span>
                    <FiCalendar size={13} className="me-1" /> Effective Date:{' '}
                    <strong>{new Date(policy.effectiveDate).toLocaleDateString()}</strong>
                  </span>
                  <span>
                    Published:{' '}
                    <strong>{new Date(policy.publishedAt || policy.createdAt).toLocaleDateString()}</strong>
                  </span>
                  {isAdmin && policy.targetAudience && (
                    <span>
                      <FiUsers size={13} className="me-1" /> Scope:{' '}
                      <strong>{policy.targetAudience} Employees</strong>
                    </span>
                  )}
                  {!isAdmin && policy.firstOpenedAt && (
                    <span>
                      First Viewed:{' '}
                      <strong>{new Date(policy.firstOpenedAt).toLocaleDateString()}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {isAdmin ? (
                  <>
                    <button
                      onClick={handleExportCsv}
                      className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5 py-1.5 px-3 fw-semibold"
                      style={{ fontSize: '0.8rem' }}
                      title="Export CSV Acknowledgement Report"
                    >
                      <FiDownload size={13} /> Export Report
                    </button>

                    <button
                      onClick={handleSendReminder}
                      disabled={sendingReminder || policy.status !== 'Published'}
                      className="btn btn-sm btn-outline-success d-flex align-items-center gap-1.5 py-1.5 px-3 fw-semibold"
                      style={{ fontSize: '0.8rem' }}
                      title="Send reminders to employees who have not signed"
                    >
                      <FiBell size={13} />
                      {sendingReminder ? 'Sending...' : 'Send Reminders'}
                    </button>
                  </>
                ) : (
                  <a
                    href="#policy-questions-section"
                    className="btn btn-sm btn-outline-success d-flex align-items-center gap-1.5 py-1.5 px-3 fw-semibold shadow-sm"
                    style={{ fontSize: '0.8rem' }}
                  >
                    <FiMessageSquare size={14} />
                    Ask a Question ({questions.length})
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* MAIN SECTION: PDF VIEWER & ROLE-SPECIFIC RIGHT PANEL                 */}
        {/* =================================================================== */}
        <div className="row g-4 mb-4">
          {/* Left Column: Official Policy Document Viewer */}
          <div className={isAdmin ? 'col-12 col-xl-7' : 'col-12 col-xl-8'}>
            <div className="card shadow-sm border-0 rounded-3 h-100">
              <div className="card-header bg-white py-2.5 px-3 px-sm-4 border-bottom d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <FiBookOpen size={18} className="text-success flex-shrink-0" />
                  <span className="fw-bold text-dark">
                    {showingSignedPdf ? 'Your Signed Policy Document' : 'Official Policy Document'}
                  </span>
                  {showingSignedPdf && (
                    <span className="badge bg-success bg-opacity-10 text-success border border-success ms-1 small">
                      <FiCheckCircle size={10} className="me-1" />
                      Digital Signature Embedded
                    </span>
                  )}
                </div>

                <div className="d-flex align-items-center gap-1.5 flex-wrap w-100 w-sm-auto justify-content-start justify-content-sm-end">
                  {/* For employees who have signed: allow toggling between original and signed copy */}
                  {!isAdmin && isAcknowledged && (
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn btn-sm ${
                          !showingSignedPdf ? 'btn-success text-white' : 'btn-outline-secondary'
                        }`}
                        style={!showingSignedPdf ? { backgroundColor: '#0F5132', borderColor: '#0F5132' } : {}}
                        onClick={() => setShowingSignedPdf(false)}
                      >
                        Original Document
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${
                          showingSignedPdf ? 'btn-success text-white' : 'btn-outline-secondary'
                        }`}
                        style={showingSignedPdf ? { backgroundColor: '#0F5132', borderColor: '#0F5132' } : {}}
                        onClick={handleToggleSignedPdfPreview}
                      >
                        <FiCheckCircle size={12} className="me-1" />
                        Signed Copy (With My Signature)
                      </button>
                    </div>
                  )}

                  {(showingSignedPdf ? signedPdfBlobUrl : pdfBlobUrl) && (
                    <a
                      href={showingSignedPdf ? signedPdfBlobUrl : pdfBlobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-outline-success d-flex align-items-center gap-1.5 py-1 px-2.5"
                      style={{ fontSize: '0.78rem' }}
                      title="Open in new browser window"
                    >
                      <FiExternalLink size={13} /> Open PDF in New Window
                    </a>
                  )}

                  {!isAdmin && isAcknowledged && (
                    <button
                      type="button"
                      onClick={() => handleDownloadSignedPdf()}
                      disabled={downloadingSignedPdf}
                      className="btn btn-sm btn-success d-flex align-items-center gap-1.5 py-1 px-2.5"
                      style={{ backgroundColor: '#0F5132', borderColor: '#0F5132', fontSize: '0.78rem' }}
                      title="Download your individual signed PDF with embedded signature"
                    >
                      <FiDownload size={13} />
                      {downloadingSignedPdf ? 'Downloading...' : 'Download Signed PDF'}
                    </button>
                  )}
                </div>
              </div>

              <div className="card-body p-4">
                {/* Policy Description / Summary */}
                {policy.description && (
                  <div className="p-3 bg-light rounded-3 border mb-4">
                    <span className="fw-bold text-dark small d-block mb-1">
                      Purpose & Overview:
                    </span>
                    <p className="mb-0 text-muted small" style={{ lineHeight: 1.6 }}>
                      {policy.description}
                    </p>
                  </div>
                )}

                {/* PDF Document Viewer Container */}
                {policy.hasPdf ? (
                  <div>
                    {loadingPdf ? (
                      <div
                        className="d-flex flex-column align-items-center justify-content-center p-5 rounded-3 border bg-light text-muted"
                        style={{ minHeight: '480px' }}
                      >
                        <div
                          className="spinner-border text-success mb-3"
                          role="status"
                          style={{ width: '2.5rem', height: '2.5rem' }}
                        ></div>
                        <span className="fw-medium">Loading secure PDF document...</span>
                        <small className="text-muted mt-1">Verifying encrypted stream permissions</small>
                      </div>
                    ) : pdfError ? (
                      <div className="p-4 rounded-3 border border-warning bg-warning bg-opacity-10 text-center">
                        <FiAlertTriangle size={32} className="text-warning mb-2" />
                        <h6 className="fw-bold text-dark mb-1">Document Stream Notice</h6>
                        <p className="text-muted small mb-3">{pdfError}</p>
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            onClick={() => loadPdfDocument(policy._id)}
                            className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                          >
                            <FiRefreshCw size={12} /> Retry Loading PDF
                          </button>
                        </div>

                        {/* Fallback to text content if available */}
                        {policy.content && (
                          <div className="mt-4 pt-3 border-top text-start">
                            <span className="fw-bold small text-dark d-block mb-2">
                              Policy Text Content:
                            </span>
                            <div
                              className="p-3 bg-white rounded border small text-dark"
                              style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                            >
                              {policy.content}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (showingSignedPdf ? signedPdfBlobUrl : pdfBlobUrl) ? (
                      <div className="pdf-viewer-wrapper rounded border overflow-hidden shadow-sm">
                        <iframe
                          src={showingSignedPdf && signedPdfBlobUrl ? signedPdfBlobUrl : pdfBlobUrl}
                          title={`Company Policy: ${policy.title}${showingSignedPdf ? ' - Signed Copy' : ''}`}
                          className="w-100 policy-pdf-iframe"
                          style={{
                            height: isAdmin ? '540px' : '620px',
                            minHeight: '360px',
                            border: 'none',
                            display: 'block',
                            backgroundColor: '#525659',
                          }}
                        />
                      </div>
                    ) : (
                      <div className="p-4 text-center bg-light rounded border text-muted small">
                        The document is currently unavailable. Please check with your HR administrator.
                      </div>
                    )}
                  </div>
                ) : (
                  /* Fallback for policies created with direct text content */
                  <div
                    className="p-4 bg-white rounded-3 border shadow-sm"
                    style={{
                      lineHeight: 1.75,
                      fontSize: '0.92rem',
                      color: '#1E293B',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {policy.content || 'No text content available for this policy document.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: ROLE-BASED CONDITIONAL RENDERING */}
          <div className={isAdmin ? 'col-12 col-xl-5' : 'col-12 col-xl-4'}>
            {isAdmin ? (
              /* ============================================================= */
              /* ADMIN VIEW: POLICY MANAGEMENT & ACKNOWLEDGEMENT STATISTICS    */
              /* (No signature pad, no checkbox, no submit acknowledgement)     */
              /* ============================================================= */
              <div className="d-flex flex-column gap-3">
                {/* 1. Acknowledgement Statistics Card */}
                <div className="card shadow-sm border-0 rounded-3">
                  <div className="card-header bg-white py-3 px-4 border-bottom d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <FiShield size={18} className="text-success" />
                      <h6 className="fw-bold text-dark mb-0">Acknowledgement Statistics</h6>
                    </div>
                    {stats && (
                      <span className="badge bg-success bg-opacity-10 text-success border border-success fw-semibold">
                        {stats.completionPercentage}% Compliant
                      </span>
                    )}
                  </div>

                  <div className="card-body p-4">
                    {loadingReport ? (
                      <div className="text-center py-4 text-muted small">
                        <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                        Calculating employee compliance...
                      </div>
                    ) : stats ? (
                      <div>
                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="d-flex justify-content-between small text-muted mb-1">
                            <span>Compliance Completion</span>
                            <span className="fw-bold text-dark">{stats.acknowledgedCount} / {stats.totalAssigned} Signed</span>
                          </div>
                          <div className="progress" style={{ height: '8px' }}>
                            <div
                              className="progress-bar bg-success"
                              role="progressbar"
                              style={{ width: `${stats.completionPercentage}%`, backgroundColor: '#0F5132' }}
                              aria-valuenow={stats.completionPercentage}
                              aria-valuemin="0"
                              aria-valuemax="100"
                            ></div>
                          </div>
                        </div>

                        {/* Metric Tiles */}
                        <div className="row g-2 text-center">
                          <div className="col-4">
                            <div className="p-2.5 bg-success bg-opacity-10 rounded border border-success">
                              <div className="fs-5 fw-bold text-success">{stats.acknowledgedCount}</div>
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>Acknowledged</small>
                            </div>
                          </div>
                          <div className="col-4">
                            <div className="p-2.5 bg-warning bg-opacity-10 rounded border border-warning">
                              <div className="fs-5 fw-bold text-warning">{stats.openedNotAcknowledgedCount}</div>
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>Opened (Pending)</small>
                            </div>
                          </div>
                          <div className="col-4">
                            <div className="p-2.5 bg-danger bg-opacity-10 rounded border border-danger">
                              <div className="fs-5 fw-bold text-danger">{stats.notOpenedCount}</div>
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>Not Opened</small>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted small text-center py-3">No compliance statistics available.</div>
                    )}
                  </div>
                </div>

                {/* 2. Policy Distribution Information Card */}
                <div className="card shadow-sm border-0 rounded-3">
                  <div className="card-header bg-white py-3 px-4 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <FiUsers size={17} className="text-primary" />
                      <h6 className="fw-bold text-dark mb-0">Distribution Information</h6>
                    </div>
                  </div>
                  <div className="card-body p-4 small">
                    <div className="d-flex justify-content-between py-1.5 border-bottom">
                      <span className="text-muted">Target Audience:</span>
                      <strong className="text-dark">{policy.targetAudience || 'All Active Employees'}</strong>
                    </div>
                    {policy.targetDepartments && policy.targetDepartments.length > 0 && (
                      <div className="d-flex justify-content-between py-1.5 border-bottom">
                        <span className="text-muted">Departments:</span>
                        <strong className="text-dark">
                          {policy.targetDepartments.map((d) => d.name || d).join(', ')}
                        </strong>
                      </div>
                    )}
                    {policy.targetRoles && policy.targetRoles.length > 0 && (
                      <div className="d-flex justify-content-between py-1.5 border-bottom">
                        <span className="text-muted">Target Roles:</span>
                        <strong className="text-dark">{policy.targetRoles.join(', ')}</strong>
                      </div>
                    )}
                    <div className="d-flex justify-content-between py-1.5 border-bottom">
                      <span className="text-muted">Current Version:</span>
                      <strong className="text-dark">Version {policy.version}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-1.5">
                      <span className="text-muted">Total Assigned:</span>
                      <strong className="text-dark">{stats?.totalAssigned || 0} Employees</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ============================================================= */
              /* EMPLOYEE VIEW: POLICY ACKNOWLEDGEMENT & DRAWN SIGNATURE PAD    */
              /* ============================================================= */
              <div className="card shadow-sm border-0 rounded-3 sticky-top" style={{ top: '1.5rem' }}>
                <div className="card-header bg-white py-3 px-4 border-bottom">
                  <div className="d-flex align-items-center gap-2">
                    <FiShield size={18} className="text-success" />
                    <h6 className="fw-bold text-dark mb-0">Policy Acknowledgement</h6>
                  </div>
                </div>

                <div className="card-body p-4">
                  {isAcknowledged ? (
                    /* STATE A: ALREADY ACKNOWLEDGED CONFIRMATION */
                    <div>
                      <div className="p-3 bg-success bg-opacity-10 border border-success rounded-3 mb-3 text-center">
                        <FiCheckCircle size={32} className="text-success mb-2" />
                        <h6 className="fw-bold text-success mb-1">Policy Successfully Signed</h6>
                        <small className="text-muted d-block" style={{ fontSize: '0.78rem' }}>
                          Electronically signed Version {policy.version} on:
                        </small>
                        <span className="fw-semibold text-dark small">
                          {new Date(policy.acknowledgedAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="mb-3">
                        <label className="text-muted small fw-medium d-block mb-1">
                          Acknowledgement Statement:
                        </label>
                        <div
                          className="p-3 bg-light rounded border small text-dark"
                          style={{ fontStyle: 'italic', lineHeight: 1.5, fontSize: '0.8rem' }}
                        >
                          "{policy.myStatement || 'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.'}"
                        </div>
                      </div>

                      {policy.mySignature && (
                        <div className="mb-3">
                          <label className="text-muted small fw-medium d-block mb-1">
                            Recorded Drawn Digital Signature:
                          </label>
                          <div className="p-3 bg-white rounded border text-center shadow-sm">
                            <img
                              src={policy.mySignature}
                              alt="Recorded Employee Signature"
                              style={{ maxHeight: 75, maxWidth: '100%', objectFit: 'contain' }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Download Signed PDF and Preview Actions */}
                      <div className="d-flex flex-column gap-2 mb-3">
                        <button
                          onClick={() => handleDownloadSignedPdf()}
                          disabled={downloadingSignedPdf}
                          className="btn btn-success w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                          style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                          title="Download individual PDF document containing embedded signature"
                        >
                          <FiDownload size={16} />
                          {downloadingSignedPdf ? 'Downloading Signed PDF...' : 'Download Signed PDF'}
                        </button>

                        <button
                          onClick={handleToggleSignedPdfPreview}
                          className="btn btn-outline-success w-100 py-1.5 fw-semibold d-flex align-items-center justify-content-center gap-2"
                        >
                          <FiEye size={15} />
                          {showingSignedPdf ? 'View Original Policy Document' : 'Preview Signed PDF'}
                        </button>
                      </div>

                      <div className="p-2.5 bg-light rounded border text-muted small text-center" style={{ fontSize: '0.72rem', lineHeight: 1.4 }}>
                        <div className="fw-semibold text-dark mb-0.5">
                          Individual Signed PDF Generated
                        </div>
                        {policy.signedPdf?.fileName && (
                          <div className="text-truncate text-secondary mb-1">
                            File: <code>{policy.signedPdf.fileName}</code>
                          </div>
                        )}
                        Internal Compliance Audit Record • One Planet Technologies CRM
                      </div>
                    </div>
                  ) : (
                    /* STATE B: PENDING ACKNOWLEDGEMENT FORM WITH SIGNATURE PAD */
                    <div>
                      <p className="text-muted small mb-3" style={{ lineHeight: 1.5 }}>
                        Please review the full policy document. Confirm your agreement and draw your electronic signature below. Your drawn signature will be embedded directly into your individual copy of the PDF document.
                      </p>

                      {/* Mandatory Statement Checkbox */}
                      <div className="form-check p-3 bg-light rounded-3 border mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="pageAckCheckbox"
                          checked={hasAgreedCheckbox}
                          onChange={(e) => setHasAgreedCheckbox(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        <label
                          className="form-check-label text-dark small fw-semibold"
                          htmlFor="pageAckCheckbox"
                          style={{ cursor: 'pointer', lineHeight: 1.4 }}
                        >
                          I confirm that I have read and understood this company policy and agree to follow the applicable guidelines. <span className="text-danger">*</span>
                        </label>
                      </div>

                      {/* Digital Signature Drawing Canvas */}
                      <div className="mb-3">
                        <label className="fw-semibold text-dark small d-flex align-items-center justify-content-between mb-1.5">
                          <span>
                            Drawn Digital Signature <span className="text-danger">*</span>
                          </span>
                          <span className="text-muted fw-normal" style={{ fontSize: '0.72rem' }}>
                            Mouse, Stylus, or Touch
                          </span>
                        </label>

                        <SignaturePad
                          onChange={(sig) => setSignatureData(sig)}
                          disabled={submittingAck}
                          height={160}
                        />
                      </div>

                      {/* Submit Action Button */}
                      <button
                        onClick={handleSubmitAcknowledgement}
                        disabled={!hasAgreedCheckbox || !signatureData.hasSignature || submittingAck}
                        className="btn btn-success w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                        style={{
                          backgroundColor: '#0F5132',
                          borderColor: '#0F5132',
                          cursor:
                            !hasAgreedCheckbox || !signatureData.hasSignature || submittingAck
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        {submittingAck ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            Embedding Signature into PDF...
                          </>
                        ) : (
                          <>
                            <FiCheckCircle size={17} />
                            Submit & Sign
                          </>
                        )}
                      </button>

                      <div className="text-muted text-center mt-2" style={{ fontSize: '0.7rem' }}>
                        Your drawn signature will be permanently embedded onto an official Certificate page inside the PDF.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* ADMIN ONLY: EMPLOYEE-WISE ACKNOWLEDGEMENT REPORT TABLE              */}
        {/* =================================================================== */}
        {isAdmin && (
          <div className="card shadow-sm border-0 rounded-3 mb-4">
            <div className="card-header bg-white py-3 px-4 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <FiUsers size={18} className="text-success" />
                <h5 className="fw-bold text-dark mb-0">Employee Acknowledgement Report</h5>
              </div>
              <span className="badge bg-light text-secondary border px-2.5 py-1" style={{ fontSize: '0.75rem' }}>
                Showing {filteredReportList.length} of {reportData?.report?.length || 0} Assigned Employees
              </span>
            </div>

            <div className="card-body p-4">
              {/* Filter Toolbar */}
              <div className="row g-2 align-items-center mb-3">
                <div className="col-12 col-md-4">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-light border-end-0">
                      <FiSearch size={13} className="text-muted" />
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder="Search by employee name, ID or email..."
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={reportStatusFilter}
                    onChange={(e) => setReportStatusFilter(e.target.value)}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Acknowledged">Acknowledged</option>
                    <option value="Opened">Opened (Pending Sign)</option>
                    <option value="Not Opened">Not Opened</option>
                  </select>
                </div>

                <div className="col-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={reportDeptFilter}
                    onChange={(e) => setReportDeptFilter(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {reportDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-2 text-md-end">
                  <button
                    onClick={handleExportCsv}
                    className="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-1.5"
                    style={{ fontSize: '0.78rem' }}
                  >
                    <FiDownload size={13} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Report Table */}
              {loadingReport ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                  Loading employee records...
                </div>
              ) : filteredReportList.length === 0 ? (
                <div className="text-center py-4 text-muted small bg-light rounded border">
                  No employee records match the selected filters.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                    <thead className="table-light text-muted small">
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Status</th>
                        <th>First Opened</th>
                        <th>Acknowledged At</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReportList.map((r) => (
                        <tr key={r._id}>
                          <td>
                            <div className="fw-semibold text-dark">{r.user.fullName}</div>
                            <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                              ID: {r.user.employeeId} • {r.user.email}
                            </small>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border small">
                              {r.user.department}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge small ${
                                r.status === 'Acknowledged'
                                  ? 'bg-success text-white'
                                  : r.status === 'Opened'
                                  ? 'bg-warning text-dark'
                                  : 'bg-danger text-white'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="text-muted">
                            {r.firstOpenedAt ? new Date(r.firstOpenedAt).toLocaleString() : 'Never Opened'}
                          </td>
                          <td className="text-muted">
                            {r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleString() : '—'}
                          </td>
                          <td className="text-end">
                            {r.status === 'Acknowledged' && r.hasSignature ? (
                              <div className="d-inline-flex align-items-center gap-1.5 flex-wrap justify-content-end">
                                <button
                                  onClick={() => handleAdminViewSignedPdf(r)}
                                  className="btn btn-sm btn-outline-success py-1 px-2.5 d-inline-flex align-items-center gap-1 fw-semibold"
                                  style={{ fontSize: '0.75rem' }}
                                  title="View complete PDF with embedded signature"
                                >
                                  <FiEye size={12} /> View Signed PDF
                                </button>

                                <button
                                  onClick={() => handleDownloadSignedPdf(r.user._id, r.signedPdf?.fileName)}
                                  className="btn btn-sm btn-success py-1 px-2.5 d-inline-flex align-items-center gap-1 fw-semibold"
                                  style={{ backgroundColor: '#0F5132', borderColor: '#0F5132', fontSize: '0.75rem' }}
                                  title="Download employee individual signed PDF document"
                                >
                                  <FiDownload size={12} /> Download Signed PDF
                                </button>

                                <button
                                  onClick={() => setInspectingSignature(r)}
                                  className="btn btn-sm btn-light border py-1 px-2 text-secondary d-inline-flex align-items-center gap-1"
                                  style={{ fontSize: '0.72rem' }}
                                  title="Inspect Raw Signature & Audit Record"
                                >
                                  <FiShield size={11} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                Not Signed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* LOWER SECTION: POLICY QUESTIONS & REPLIES                           */}
        {/* Directly below the viewer and management/acknowledgement section    */}
        {/* =================================================================== */}
        <div id="policy-questions-section" className="card shadow-sm border-0 rounded-3 mb-4">
          <div className="card-header bg-white py-3 px-4 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <FiMessageSquare size={18} className="text-success" />
              <div>
                <h5 className="fw-bold text-dark mb-0">Policy Questions & Clarifications</h5>
                <small className="text-muted">
                  {isAdmin
                    ? 'Review inquiries submitted by employees for this policy and reply directly.'
                    : 'Ask questions or request clarifications on this policy. Employees can submit questions at any time, before or after acknowledging.'}
                </small>
              </div>
            </div>
            <span className="badge bg-light text-secondary border px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>
              {questions.length} {questions.length === 1 ? 'Question' : 'Questions'} Submitted
            </span>
          </div>

          <div className="card-body p-4">
            <div className="row g-4">
              {/* Left Column: Questions List & Conversation History */}
              <div className={isAdmin ? 'col-12' : 'col-12 col-lg-7'}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                    <FiHelpCircle className="text-success" />
                    {isAdmin ? 'Employee Inquiries & Threads' : 'My Questions & Admin Replies'}
                  </h6>
                  <button
                    onClick={() => loadPolicyQuestions(policy._id)}
                    className="btn btn-sm btn-link text-muted p-0 d-flex align-items-center gap-1"
                    style={{ fontSize: '0.75rem' }}
                    title="Refresh conversation"
                  >
                    <FiRefreshCw size={11} /> Refresh
                  </button>
                </div>

                {loadingQuestions ? (
                  <div className="text-center py-5 text-muted bg-light rounded-3 border">
                    <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                    Loading conversation history...
                  </div>
                ) : questions.length === 0 ? (
                  <div className="text-center py-5 px-3 bg-light rounded-3 border text-muted">
                    <FiMessageSquare size={38} className="text-secondary opacity-50 mb-2" />
                    <h6 className="fw-semibold text-dark mb-1">No Questions Submitted Yet</h6>
                    <p className="small mb-0 mx-auto" style={{ maxWidth: 400 }}>
                      {isAdmin
                        ? 'No employee inquiries have been submitted for this policy document yet.'
                        : 'Have a query about clauses, eligibility, or guidelines in this document? Use the form to submit your question directly to HR/Management.'}
                    </p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {questions.map((q) => {
                      const isHighlighted = targetQuestionId === q._id;
                      return (
                        <div
                          key={q._id}
                          id={`question-${q._id}`}
                          className={`p-3.5 rounded-3 border transition-all ${
                            isHighlighted
                              ? 'border-2 border-success bg-white shadow'
                              : 'bg-light bg-opacity-75'
                          }`}
                        >
                          {/* Question Top Header */}
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-2 flex-wrap">
                            <div>
                              <span className="fw-bold text-dark small d-block mb-1">
                                {q.title || 'Policy Question'}
                              </span>
                              <div className="d-flex align-items-center gap-2 flex-wrap">
                                <span
                                  className={`badge small ${
                                    q.status === 'Resolved'
                                      ? 'bg-success text-white'
                                      : q.status === 'Answered'
                                      ? 'bg-primary text-white'
                                      : q.status === 'Open'
                                      ? 'bg-warning text-dark'
                                      : 'bg-secondary text-white'
                                  }`}
                                  style={{ fontSize: '0.7rem' }}
                                >
                                  {q.status}
                                </span>

                                <span className="text-muted small" style={{ fontSize: '0.74rem' }}>
                                  Version {q.policyVersion || policy.version}
                                </span>

                                {q.user && (
                                  <span className="badge bg-white text-secondary border small" style={{ fontSize: '0.7rem' }}>
                                    <FiUser size={10} className="me-1" />
                                    {q.user.fullName} ({q.user.employeeId || q.employeeId})
                                    {q.user.department && ` • ${q.user.department.name || q.user.department}`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                {new Date(q.createdAt).toLocaleString()}
                              </small>

                              {/* Admin Status Actions */}
                              {isAdmin && (
                                <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                  {q.status !== 'Resolved' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStatus(q._id, 'Resolved')}
                                      className="btn btn-xs btn-outline-success py-0.5 px-2 d-flex align-items-center gap-1 fw-semibold"
                                      style={{ fontSize: '0.7rem', height: '26px' }}
                                      title="Mark as Resolved"
                                    >
                                      <FiCheckCircle size={10} /> Mark Resolved
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStatus(q._id, 'Open')}
                                      className="btn btn-xs btn-outline-warning py-0.5 px-2 d-flex align-items-center gap-1 fw-semibold"
                                      style={{ fontSize: '0.7rem', height: '26px' }}
                                      title="Reopen Question"
                                    >
                                      <FiRotateCcw size={10} /> Reopen
                                    </button>
                                  )}

                                  <select
                                    aria-label="Question Status"
                                    className={`form-select form-select-sm py-0 px-2 fw-semibold ${
                                      q.status === 'Open'
                                        ? 'border-warning text-dark bg-warning-subtle'
                                        : q.status === 'Answered'
                                        ? 'border-primary text-primary bg-primary-subtle'
                                        : 'border-success text-success bg-success-subtle'
                                    }`}
                                    style={{
                                      fontSize: '0.7rem',
                                      width: 'auto',
                                      minWidth: '105px',
                                      cursor: 'pointer',
                                      height: '26px',
                                    }}
                                    value={q.status || 'Open'}
                                    disabled={updatingStatusId === q._id}
                                    onChange={(e) => handleUpdateStatus(q._id, e.target.value)}
                                  >
                                    <option value="Open">Open</option>
                                    <option value="Answered">Answered</option>
                                    <option value="Resolved">Resolved</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Question Message */}
                          <div className="p-2.5 bg-white rounded border small text-dark mb-3" style={{ lineHeight: 1.5 }}>
                            {q.question}
                          </div>

                          {/* Conversation History: Threaded Replies */}
                          {q.replies && q.replies.length > 0 && (
                            <div className="ps-3 border-start border-3 border-success ms-2 mb-3">
                              <span className="fw-bold text-dark small d-block mb-2" style={{ fontSize: '0.76rem' }}>
                                Conversation History:
                              </span>
                              {q.replies.map((reply, rIdx) => (
                                <div
                                  key={reply._id || rIdx}
                                  className={`p-2.5 rounded border mb-2 small ${
                                    reply.role === 'Admin'
                                      ? 'bg-success bg-opacity-10 border-success'
                                      : 'bg-white border'
                                  }`}
                                >
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="fw-bold small d-flex align-items-center gap-1.5">
                                      <FiCornerDownRight size={12} className="text-muted" />
                                      {reply.user?.fullName || 'User'}
                                      <span
                                        className={`badge ${
                                          reply.role === 'Admin'
                                            ? 'bg-success text-white'
                                            : 'bg-light text-dark border'
                                        }`}
                                        style={{ fontSize: '0.65rem' }}
                                      >
                                        {reply.role === 'Admin' ? 'Admin / HR' : 'Employee Follow-up'}
                                      </span>
                                    </span>
                                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                                      {new Date(reply.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="mb-0 text-dark small ps-3" style={{ lineHeight: 1.45, fontSize: '0.8rem' }}>
                                    {reply.message}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Follow-up / Continue Conversation Reply Box */}
                          <div className="mt-2 pt-2 border-top">
                            <div className="input-group input-group-sm">
                              <input
                                type="text"
                                className="form-control"
                                placeholder={
                                  isAdmin
                                    ? 'Reply as Admin/HR to employee...'
                                    : 'Ask a follow-up clarification...'
                                }
                                value={followUpTexts[q._id] || ''}
                                onChange={(e) =>
                                  setFollowUpTexts((prev) => ({
                                    ...prev,
                                    [q._id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSubmitReply(q._id);
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleSubmitReply(q._id)}
                                disabled={submittingReplyId === q._id || !followUpTexts[q._id]?.trim()}
                                className="btn btn-outline-success d-flex align-items-center gap-1"
                              >
                                {submittingReplyId === q._id ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm" role="status"></span>
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <FiSend size={11} />
                                    {isAdmin ? 'Send Reply' : 'Send'}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Ask a Question Form (Only for Non-Admin) */}
              {!isAdmin && (
                <div className="col-12 col-lg-5">
                  <div className="card border rounded-3 bg-light bg-opacity-50">
                    <div className="card-header bg-white py-3 px-3 border-bottom">
                      <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                        <FiSend className="text-success" /> Ask a Question
                      </h6>
                    </div>

                    <div className="card-body p-3 p-md-4">
                      <p className="text-muted small mb-3" style={{ lineHeight: 1.5 }}>
                        Need clarification regarding guidelines, exceptions, or specific requirements in this policy? Send your question below.
                      </p>

                      <div className="p-2.5 bg-success bg-opacity-10 rounded border border-success mb-3 text-success small" style={{ fontSize: '0.76rem' }}>
                        <FiCheckCircle size={13} className="me-1.5" />
                        <strong>Notice:</strong> Employees can submit questions at any time, even before completing policy acknowledgement.
                      </div>

                      <form onSubmit={handleSubmitQuestion}>
                        <div className="mb-3">
                          <label className="form-label small fw-semibold text-dark">
                            Question Title / Subject <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Clause 3.2 overtime policy eligibility"
                            value={newQuestionTitle}
                            onChange={(e) => setNewQuestionTitle(e.target.value)}
                            required
                          />
                        </div>

                        <div className="mb-3">
                          <label className="form-label small fw-semibold text-dark">
                            Question Description / Message <span className="text-danger">*</span>
                          </label>
                          <textarea
                            className="form-control form-control-sm"
                            rows="4"
                            placeholder="Describe your question or request for clarification in detail..."
                            value={newQuestionMessage}
                            onChange={(e) => setNewQuestionMessage(e.target.value)}
                            required
                          ></textarea>
                        </div>

                        <button
                          type="submit"
                          disabled={submittingQuestion || !newQuestionMessage.trim()}
                          className="btn btn-success btn-sm w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                          style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                        >
                          {submittingQuestion ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status"></span>
                              Submitting Question...
                            </>
                          ) : (
                            <>
                              <FiSend size={13} /> Submit Question to HR
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* MODAL: ADMIN INSPECT DRAWN DIGITAL SIGNATURE                        */}
        {/* =================================================================== */}
        {inspectingSignature && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)' }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg border-0 rounded-3">
                <div className="modal-header bg-light py-3 px-4 border-bottom">
                  <div className="d-flex align-items-center gap-2">
                    <FiShield className="text-success" size={18} />
                    <h6 className="modal-title fw-bold text-dark mb-0">
                      Authenticated Electronic Signature Verification
                    </h6>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setInspectingSignature(null)}
                  ></button>
                </div>

                <div className="modal-body p-4">
                  {/* Employee Identity */}
                  <div className="p-3 bg-light rounded-3 border mb-3 small">
                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Employee:</span>
                      <strong className="text-dark">{inspectingSignature.user.fullName}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Employee ID:</span>
                      <strong className="text-dark">{inspectingSignature.user.employeeId}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Department:</span>
                      <strong className="text-dark">{inspectingSignature.user.department}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Policy Version:</span>
                      <strong className="text-dark">Version {inspectingSignature.policyVersion}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-1">
                      <span className="text-muted">Signed Date:</span>
                      <strong className="text-dark">
                        {inspectingSignature.acknowledgedAt
                          ? new Date(inspectingSignature.acknowledgedAt).toLocaleString()
                          : '—'}
                      </strong>
                    </div>
                  </div>

                  {/* Drawn Digital Signature */}
                  <div className="mb-3 text-center">
                    <label className="text-muted small fw-medium d-block mb-1.5 text-start">
                      Recorded Drawn Digital Signature:
                    </label>
                    <div className="p-3 bg-white rounded border shadow-sm d-inline-block w-100">
                      <img
                        src={inspectingSignature.signatureImage}
                        alt="Recorded Employee Signature"
                        style={{ maxHeight: 90, maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  </div>

                  {/* Acknowledgement Statement */}
                  <div className="p-2.5 bg-light rounded border small text-dark mb-3" style={{ fontStyle: 'italic', fontSize: '0.78rem' }}>
                    "{inspectingSignature.statement || 'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.'}"
                  </div>

                  {inspectingSignature.confirmationRecord && (
                    <div className="p-2 bg-success bg-opacity-10 border border-success rounded text-success small" style={{ fontSize: '0.72rem' }}>
                      <FiCheckCircle size={12} className="me-1" />
                      <strong>SHA-256 Audit Hash:</strong> {inspectingSignature.confirmationRecord.sha256Hash || 'Verified cryptographically'}
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light py-2 px-4 border-top">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setInspectingSignature(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL: ADMIN VIEW EMPLOYEE SIGNED PDF DOCUMENT                      */}
        {/* =================================================================== */}
        {inspectingSignedPdf && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(3px)', zIndex: 1060 }}
          >
            <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: '92%' }}>
              <div className="modal-content shadow-lg border-0 rounded-3 overflow-hidden">
                <div className="modal-header bg-light py-3 px-4 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <FiShield className="text-success" size={20} />
                    <div>
                      <h6 className="modal-title fw-bold text-dark mb-0">
                        Official Signed Policy Document — {inspectingSignedPdf.user?.fullName}
                      </h6>
                      <small className="text-muted">
                        Employee ID: <strong>{inspectingSignedPdf.user?.employeeId}</strong> • Department:{' '}
                        <strong>{inspectingSignedPdf.user?.department}</strong> • Signed On:{' '}
                        <strong>
                          {inspectingSignedPdf.acknowledgedAt
                            ? new Date(inspectingSignedPdf.acknowledgedAt).toLocaleString()
                            : 'N/A'}
                        </strong>
                      </small>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    {inspectingSignedPdf.blobUrl && (
                      <>
                        <a
                          href={inspectingSignedPdf.blobUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline-success d-flex align-items-center gap-1.5"
                          style={{ fontSize: '0.78rem' }}
                        >
                          <FiExternalLink size={13} /> Open in New Window
                        </a>

                        <button
                          type="button"
                          className="btn btn-sm btn-success d-flex align-items-center gap-1.5"
                          style={{ backgroundColor: '#0F5132', borderColor: '#0F5132', fontSize: '0.78rem' }}
                          onClick={() =>
                            handleDownloadSignedPdf(
                              inspectingSignedPdf.user?._id,
                              inspectingSignedPdf.fileName
                            )
                          }
                          disabled={downloadingSignedPdf}
                        >
                          <FiDownload size={13} />
                          {downloadingSignedPdf ? 'Downloading...' : 'Download Signed PDF'}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      className="btn-close ms-2"
                      onClick={() => {
                        if (inspectingSignedPdf?.blobUrl) {
                          URL.revokeObjectURL(inspectingSignedPdf.blobUrl);
                        }
                        setInspectingSignedPdf(null);
                      }}
                    ></button>
                  </div>
                </div>

                <div
                  className="modal-body p-0"
                  style={{ backgroundColor: '#525659', minHeight: 'min(620px, 70vh)' }}
                >
                  {inspectingSignedPdf.loading ? (
                    <div
                      className="d-flex flex-column align-items-center justify-content-center p-4 p-sm-5 text-white"
                      style={{ minHeight: 'min(500px, 60vh)' }}
                    >
                      <div className="spinner-border text-light mb-3" role="status"></div>
                      <h6>Loading signed policy document...</h6>
                      <small className="text-light opacity-75">
                        Verifying individual digital signature certificate and audit stamp
                      </small>
                    </div>
                  ) : inspectingSignedPdf.blobUrl ? (
                    <iframe
                      src={inspectingSignedPdf.blobUrl}
                      title={`Signed Policy Document - ${inspectingSignedPdf.user?.fullName}`}
                      className="w-100 policy-pdf-iframe"
                      style={{
                        height: '75vh',
                        minHeight: 'min(600px, 65vh)',
                        border: 'none',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div className="p-5 text-center text-white">
                      <p>Unable to load signed PDF document stream.</p>
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light py-2 px-4 border-top d-flex justify-content-between align-items-center">
                  <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                    Certified PDF document generated with embedded employee digital signature & cryptographic stamp.
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      if (inspectingSignedPdf?.blobUrl) {
                        URL.revokeObjectURL(inspectingSignedPdf.blobUrl);
                      }
                      setInspectingSignedPdf(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default PolicyViewAcknowledgePage;

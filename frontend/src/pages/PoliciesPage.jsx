import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import { SignaturePad } from '../components/SignaturePad';
import {
  FiBookOpen,
  FiPlus,
  FiSearch,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiUsers,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiArchive,
  FiCheck,
  FiCalendar,
  FiTag,
  FiFileText,
  FiX,
  FiRotateCcw,
  FiDownload,
  FiBell,
  FiMessageSquare,
  FiHelpCircle,
  FiSend,
  FiFilter,
  FiCornerDownRight,
  FiShield,
  FiUploadCloud,
  FiFile,
  FiExternalLink,
  FiCheckSquare,
} from 'react-icons/fi';

const PRESET_CATEGORIES = [
  'Code of Conduct & Ethics',
  'Human Resources & Employment',
  'Information Security & IT',
  'Leave, Attendance & Hours',
  'Workplace Health & Safety',
  'Remote Work & Equipment',
  'Data Privacy & Confidentiality',
  'General & Governance',
];

export const PoliciesPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  // Navigation Tabs:
  // Admin: 'policies' | 'reports' | 'questions'
  // Employee/Manager: 'policies' | 'my-questions'
  const [activeMainTab, setActiveMainTab] = useState('policies');

  // Handle URL query parameters for notifications / direct links
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'questions') {
      setActiveMainTab(isAdmin ? 'questions' : 'my-questions');
    } else if (tabParam === 'reports' && isAdmin) {
      setActiveMainTab('reports');
    }

    const questionIdParam = searchParams.get('questionId');
    if (questionIdParam) {
      setTimeout(() => {
        const el = document.getElementById(`admin-question-${questionIdParam}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
    }
  }, [searchParams, isAdmin]);

  const [policies, setPolicies] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for Policies List
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // For Admin: All, Published, Draft, Archived
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState('All'); // All, Not Opened, Opened, Acknowledged

  // =========================================================================
  // MODAL 1: POLICY READER, PDF VIEWER & DRAWN SIGNATURE ACKNOWLEDGEMENT
  // =========================================================================
  const [readerPolicy, setReaderPolicy] = useState(null);
  const [readerActiveTab, setReaderActiveTab] = useState('document'); // 'document' | 'questions'
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [hasAgreedCheckbox, setHasAgreedCheckbox] = useState(false);
  const [signatureData, setSignatureData] = useState({ hasSignature: false, dataUrl: '' });
  const [acknowledging, setAcknowledging] = useState(false);

  // In-Reader Questions State
  const [readerQuestions, setReaderQuestions] = useState([]);
  const [loadingReaderQuestions, setLoadingReaderQuestions] = useState(false);
  const [newQuestionTitle, setNewQuestionTitle] = useState('');
  const [newQuestionMessage, setNewQuestionMessage] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [followUpTexts, setFollowUpTexts] = useState({});
  const [submittingReplyId, setSubmittingReplyId] = useState(null);

  // =========================================================================
  // MODAL 2: CREATE / EDIT POLICY (ADMIN ONLY) - WITH PDF UPLOAD
  // =========================================================================
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState(null);
  const [policyForm, setPolicyForm] = useState({
    title: '',
    category: 'Code of Conduct & Ethics',
    customCategory: '',
    description: '',
    content: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    status: 'Published',
    targetAudience: 'All',
    targetDepartments: [],
    targetRoles: ['Employee', 'Manager'],
    changeSummary: '',
  });
  const [selectedPdfFile, setSelectedPdfFile] = useState(null);
  const [pdfPreviewModalUrl, setPdfPreviewModalUrl] = useState(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const fileInputRef = useRef(null);

  // =========================================================================
  // MODAL 3: VERSION HISTORY (ADMIN ONLY)
  // =========================================================================
  const [historyModalPolicy, setHistoryModalPolicy] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState(null);

  // =========================================================================
  // MODAL 4: SIGNATURE INSPECTOR MODAL (ADMIN ONLY)
  // =========================================================================
  const [inspectingSignature, setInspectingSignature] = useState(null);

  // =========================================================================
  // SECTION 4: ADMIN ACKNOWLEDGEMENT REPORT TAB
  // =========================================================================
  const [selectedReportPolicyId, setSelectedReportPolicyId] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [reportDeptFilter, setReportDeptFilter] = useState('All');
  const [reportStatusFilter, setReportStatusFilter] = useState('All');
  const [sendingReminders, setSendingReminders] = useState(false);

  // =========================================================================
  // SECTION 5: CENTRAL QUESTIONS & CLARIFICATIONS TAB
  // =========================================================================
  const [centralQuestions, setCentralQuestions] = useState([]);
  const [loadingCentralQuestions, setLoadingCentralQuestions] = useState(false);
  const [centralStatusFilter, setCentralStatusFilter] = useState('All');
  const [centralPolicyFilter, setCentralPolicyFilter] = useState('All');
  const [centralReplyTexts, setCentralReplyTexts] = useState({});
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // -------------------------------------------------------------------------
  // Fetch initial data: Policies & Departments
  // -------------------------------------------------------------------------
  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const params = {};
      if (isAdmin && statusFilter !== 'All') {
        params.status = statusFilter;
      }
      if (selectedCategory !== 'All') {
        params.category = selectedCategory;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (!isAdmin && employeeStatusFilter !== 'All') {
        params.acknowledgementStatus = employeeStatusFilter;
      }

      const res = await api.get('/policies', { params });
      if (res.data?.success) {
        const fetchedPolicies = res.data.policies || [];
        setPolicies(fetchedPolicies);
        if (res.data.totalActiveEmployees) {
          setTotalEmployees(res.data.totalActiveEmployees);
        }

        // Set default report policy if none selected yet
        if (!selectedReportPolicyId && fetchedPolicies.length > 0) {
          const firstPublished = fetchedPolicies.find((p) => p.status === 'Published');
          if (firstPublished) {
            setSelectedReportPolicyId(firstPublished._id);
          } else {
            setSelectedReportPolicyId(fetchedPolicies[0]._id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching policies:', err);
      toast.error(err.response?.data?.message || 'Failed to load company policies.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      if (res.data?.success) {
        setDepartments(res.data.departments || []);
      }
    } catch (err) {
      console.warn('Could not load departments:', err);
    }
  };

  useEffect(() => {
    fetchPolicies();
    fetchDepartments();
  }, [statusFilter, selectedCategory, employeeStatusFilter]);

  // Lock background page scrolling while any modal is open
  const isAnyModalOpen = Boolean(
    showEditModal ||
      readerPolicy ||
      historyModalPolicy ||
      inspectingSignature ||
      pdfPreviewModalUrl
  );

  useEffect(() => {
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isAnyModalOpen]);

  // Clean up blob URL on reader close
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // -------------------------------------------------------------------------
  // Load Acknowledgement Report when selected policy changes
  // -------------------------------------------------------------------------
  const fetchAcknowledgementReport = async (policyId) => {
    const idToFetch = policyId || selectedReportPolicyId;
    if (!idToFetch) return;

    try {
      setLoadingReport(true);
      const res = await api.get(`/policies/${idToFetch}/report`, {
        params: {
          search: reportSearch.trim() || undefined,
          department: reportDeptFilter !== 'All' ? reportDeptFilter : undefined,
          status: reportStatusFilter !== 'All' ? reportStatusFilter : undefined,
        },
      });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching acknowledgement report:', err);
      toast.error(err.response?.data?.message || 'Failed to load acknowledgement report.');
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'reports' && selectedReportPolicyId) {
      fetchAcknowledgementReport(selectedReportPolicyId);
    }
  }, [activeMainTab, selectedReportPolicyId, reportDeptFilter, reportStatusFilter]);

  // -------------------------------------------------------------------------
  // Load Central Questions Tab Data
  // -------------------------------------------------------------------------
  const fetchCentralQuestions = async () => {
    try {
      setLoadingCentralQuestions(true);
      const params = {};
      if (centralStatusFilter !== 'All') params.status = centralStatusFilter;
      if (centralPolicyFilter !== 'All') params.policyId = centralPolicyFilter;

      const res = await api.get('/policies/questions/all', { params });
      if (res.data?.success) {
        setCentralQuestions(res.data.questions || []);
      }
    } catch (err) {
      console.error('Error fetching central questions:', err);
    } finally {
      setLoadingCentralQuestions(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'questions' || activeMainTab === 'my-questions') {
      fetchCentralQuestions();
    }
  }, [activeMainTab, centralStatusFilter, centralPolicyFilter]);

  // -------------------------------------------------------------------------
  // Metrics Calculation for KPIs
  // -------------------------------------------------------------------------
  const metrics = useMemo(() => {
    const total = policies.length;
    const published = policies.filter((p) => p.status === 'Published').length;
    const drafts = policies.filter((p) => p.status === 'Draft').length;
    const archived = policies.filter((p) => p.status === 'Archived').length;

    const notOpenedCount = policies.filter((p) => p.statusForUser === 'Not Opened').length;
    const openedCount = policies.filter((p) => p.statusForUser === 'Opened').length;
    const acknowledgedCount = policies.filter((p) => p.statusForUser === 'Acknowledged').length;

    // Company wide compliance for Admin
    let totalPossibleAcks = 0;
    let totalActualAcks = 0;
    policies.forEach((p) => {
      if (p.status === 'Published' && p.complianceStats) {
        totalPossibleAcks += p.complianceStats.totalAssigned;
        totalActualAcks += p.complianceStats.acknowledgedCount;
      }
    });

    const companyComplianceRate =
      totalPossibleAcks > 0 ? Math.round((totalActualAcks / totalPossibleAcks) * 100) : 0;

    return {
      total,
      published,
      drafts,
      archived,
      notOpenedCount,
      openedCount,
      acknowledgedCount,
      companyComplianceRate,
    };
  }, [policies]);

  // Filtered policies list for display
  const displayedPolicies = useMemo(() => {
    return policies.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title?.toLowerCase().includes(q);
        const matchCat = p.category?.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q);
        return matchTitle || matchCat || matchDesc;
      }
      return true;
    });
  }, [policies, searchQuery]);

  // -------------------------------------------------------------------------
  // ACTION: Open Policy Reader Modal & Stream Secure PDF
  // Records document open in background without marking as acknowledged
  // -------------------------------------------------------------------------
  const handleOpenReader = async (policy) => {
    setReaderPolicy(policy);
    setReaderActiveTab('document');
    setHasAgreedCheckbox(false);
    setSignatureData({ hasSignature: false, dataUrl: '' });

    // Revoke old blob URL if any
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }

    // 1. Silently record first-opened / latest-opened timestamps in MongoDB
    try {
      await api.post(`/policies/${policy._id}/track-open`);
    } catch (err) {
      console.warn('Track open background ping failed:', err);
    }

    // 2. Fetch secure PDF blob if policy has an attached PDF
    if (policy.hasPdf) {
      try {
        setLoadingPdf(true);
        const response = await api.get(`/policies/${policy._id}/pdf`, {
          responseType: 'blob',
        });
        const fileUrl = URL.createObjectURL(
          new Blob([response.data], { type: 'application/pdf' })
        );
        setPdfBlobUrl(fileUrl);
      } catch (err) {
        console.error('Failed to load secure PDF:', err);
        toast.error('Could not load the attached policy PDF document.');
      } finally {
        setLoadingPdf(false);
      }
    }

    // 3. Fetch questions for this policy
    fetchReaderQuestions(policy._id);
  };

  const fetchReaderQuestions = async (policyId) => {
    try {
      setLoadingReaderQuestions(true);
      const res = await api.get(`/policies/${policyId}/questions`);
      if (res.data?.success) {
        setReaderQuestions(res.data.questions || []);
      }
    } catch (err) {
      console.error('Failed to load policy questions:', err);
    } finally {
      setLoadingReaderQuestions(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Submit Drawn Digital Signature & Acknowledgement
  // -------------------------------------------------------------------------
  const handleSubmitAcknowledgement = async (policyId) => {
    if (!hasAgreedCheckbox) {
      toast.error('Please check the confirmation box confirming that you have read and understood the policy.');
      return;
    }

    if (!signatureData.hasSignature || !signatureData.dataUrl) {
      toast.error('A drawn digital signature is required. Please sign in the pad provided.');
      return;
    }

    try {
      setAcknowledging(true);
      const res = await api.post(`/policies/${policyId}/acknowledge`, {
        statement:
          'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.',
        signatureImage: signatureData.dataUrl,
      });

      toast.success(res.data?.message || 'Policy signed and acknowledged successfully!');

      if (readerPolicy && readerPolicy._id === policyId) {
        setReaderPolicy((prev) => ({
          ...prev,
          isAcknowledged: true,
          isCurrentVersionAcknowledged: true,
          acknowledgedAt: new Date().toISOString(),
          statusForUser: 'Acknowledged',
          mySignature: signatureData.dataUrl,
          myStatement:
            'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.',
        }));
      }

      fetchPolicies();
      if (selectedReportPolicyId === policyId) {
        fetchAcknowledgementReport(policyId);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit policy acknowledgement.');
    } finally {
      setAcknowledging(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Ask Question on Policy
  // -------------------------------------------------------------------------
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionMessage.trim() || !readerPolicy) return;

    try {
      setSubmittingQuestion(true);
      const res = await api.post(`/policies/${readerPolicy._id}/questions`, {
        title: newQuestionTitle.trim() || 'General Policy Clarification',
        message: newQuestionMessage.trim(),
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Question submitted to Admin/HR.');
        setNewQuestionTitle('');
        setNewQuestionMessage('');
        fetchReaderQuestions(readerPolicy._id);
        fetchCentralQuestions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit question.');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Reply to a Question (Admin response or Employee follow-up)
  // -------------------------------------------------------------------------
  const handleReplyQuestion = async (policyId, questionId, replyText, isCentral = false) => {
    if (!replyText || !replyText.trim()) {
      toast.error('Reply message cannot be empty.');
      return;
    }

    try {
      setSubmittingReplyId(questionId);
      const res = await api.post(`/policies/${policyId}/questions/${questionId}/reply`, {
        message: replyText.trim(),
      });
      if (res.data?.success) {
        toast.success('Reply posted successfully.');
        if (isCentral) {
          setCentralReplyTexts((prev) => ({ ...prev, [questionId]: '' }));
          fetchCentralQuestions();
        } else {
          setFollowUpTexts((prev) => ({ ...prev, [questionId]: '' }));
          if (readerPolicy) fetchReaderQuestions(readerPolicy._id);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post reply.');
    } finally {
      setSubmittingReplyId(null);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Change Question Status (Admin only)
  // -------------------------------------------------------------------------
  const handleUpdateQuestionStatus = async (policyId, questionId, newStatus) => {
    if (!questionId || !newStatus) return;
    try {
      setUpdatingStatusId(questionId);
      // Optimistic update so UI updates immediately
      setCentralQuestions((prev) =>
        prev.map((item) =>
          item._id === questionId ? { ...item, status: newStatus } : item
        )
      );

      const endpoint = policyId
        ? `/policies/${policyId}/questions/${questionId}/status`
        : `/policies/questions/${questionId}/status`;

      const res = await api.patch(endpoint, {
        status: newStatus,
      });

      if (res.data?.success) {
        toast.success(`Question marked as ${newStatus}.`);
        if (readerPolicy) fetchReaderQuestions(readerPolicy._id);
        fetchCentralQuestions();
      } else {
        fetchCentralQuestions();
      }
    } catch (err) {
      console.error('Error updating question status:', err);
      toast.error(err.response?.data?.message || 'Failed to update status.');
      fetchCentralQuestions();
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Toggle Question Public FAQ (Admin only)
  // -------------------------------------------------------------------------
  const handleToggleFAQ = async (policyId, questionId) => {
    try {
      const res = await api.patch(`/policies/${policyId}/questions/${questionId}/faq`, {});
      if (res.data?.success) {
        toast.success(res.data.message);
        if (readerPolicy) fetchReaderQuestions(readerPolicy._id);
        fetchCentralQuestions();
      }
    } catch (err) {
      toast.error('Failed to toggle FAQ status.');
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Send Policy Acknowledgement Reminders (Admin only)
  // -------------------------------------------------------------------------
  const handleSendReminders = async () => {
    if (!selectedReportPolicyId) return;
    try {
      setSendingReminders(true);
      const res = await api.post(`/policies/${selectedReportPolicyId}/send-reminder`);
      toast.success(res.data?.message || 'Reminders sent to all pending employees.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reminders.');
    } finally {
      setSendingReminders(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Export Report to CSV
  // -------------------------------------------------------------------------
  const handleExportCSV = () => {
    if (!reportData || !reportData.report || reportData.report.length === 0) {
      toast.info('No data available to export.');
      return;
    }

    const headers = [
      'Employee ID',
      'Full Name',
      'Email',
      'Department',
      'Role',
      'Policy Title',
      'Policy Version',
      'Policy Status',
      'First Opened Date',
      'Latest Opened Date',
      'Acknowledgement Date',
      'Has Signature',
      'Statement',
    ];

    const rows = reportData.report.map((r) => [
      `"${(r.user?.employeeId || '').replace(/"/g, '""')}"`,
      `"${(r.user?.fullName || '').replace(/"/g, '""')}"`,
      `"${(r.user?.email || '').replace(/"/g, '""')}"`,
      `"${(r.user?.department || '').replace(/"/g, '""')}"`,
      `"${(r.user?.role || '').replace(/"/g, '""')}"`,
      `"${(reportData.policyTitle || '').replace(/"/g, '""')}"`,
      `"v${r.policyVersion || reportData.policyVersion || 1}"`,
      `"${(r.status || '').replace(/"/g, '""')}"`,
      `"${r.firstOpenedAt ? new Date(r.firstOpenedAt).toLocaleString() : 'Not Opened'}"`,
      `"${r.latestOpenedAt ? new Date(r.latestOpenedAt).toLocaleString() : 'Not Opened'}"`,
      `"${r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleString() : 'Pending'}"`,
      `"${r.hasSignature ? 'Yes (Drawn)' : 'No'}"`,
      `"${(r.statement || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeTitle = (reportData.policyTitle || 'Policy').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute(
      'download',
      `Policy_Acknowledgement_Report_${safeTitle}_v${reportData.policyVersion}_${
        new Date().toISOString().split('T')[0]
      }.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Acknowledgement report exported to CSV successfully.');
  };

  // -------------------------------------------------------------------------
  // ACTION: File input handler with client-side PDF validation
  // -------------------------------------------------------------------------
  const handlePdfFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Invalid file format. Please upload a PDF document (.pdf).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size exceeds 25 MB limit. Please select a smaller PDF.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedPdfFile(file);
    toast.info(`Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`);
  };

  // -------------------------------------------------------------------------
  // ACTION: Open Create Policy Modal
  // -------------------------------------------------------------------------
  const handleOpenCreateModal = () => {
    setEditingPolicyId(null);
    setSelectedPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPolicyForm({
      title: '',
      category: 'Code of Conduct & Ethics',
      customCategory: '',
      description: '',
      content: '',
      effectiveDate: new Date().toISOString().split('T')[0],
      status: 'Published',
      targetAudience: 'All',
      targetDepartments: [],
      targetRoles: ['Employee', 'Manager'],
      changeSummary: '',
    });
    setShowEditModal(true);
  };

  // -------------------------------------------------------------------------
  // ACTION: Open Edit Policy Modal
  // -------------------------------------------------------------------------
  const handleOpenEditModal = (policy) => {
    setEditingPolicyId(policy._id);
    setSelectedPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const isPreset = PRESET_CATEGORIES.includes(policy.category);
    setPolicyForm({
      title: policy.title,
      category: isPreset ? policy.category : 'Other',
      customCategory: isPreset ? '' : policy.category,
      description: policy.description || '',
      content: policy.content || '',
      effectiveDate: policy.effectiveDate
        ? new Date(policy.effectiveDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      status: policy.status,
      targetAudience: policy.targetAudience || 'All',
      targetDepartments: policy.targetDepartments?.map((d) => d._id || d) || [],
      targetRoles: policy.targetRoles || ['Employee', 'Manager'],
      changeSummary: '',
    });
    setShowEditModal(true);
  };

  // -------------------------------------------------------------------------
  // ACTION: Save Policy (FormData multipart with PDF upload)
  // -------------------------------------------------------------------------
  const handleSavePolicy = async (e) => {
    e.preventDefault();
    const finalCategory =
      policyForm.category === 'Other'
        ? policyForm.customCategory.trim() || 'General'
        : policyForm.category;

    if (!policyForm.title.trim()) {
      toast.error('Policy title is required.');
      return;
    }

    try {
      setSavingPolicy(true);
      const formData = new FormData();
      formData.append('title', policyForm.title.trim());
      formData.append('category', finalCategory);
      formData.append('description', policyForm.description.trim());
      formData.append('content', policyForm.content.trim());
      formData.append('effectiveDate', policyForm.effectiveDate);
      formData.append('status', policyForm.status);
      formData.append('targetAudience', policyForm.targetAudience);
      formData.append('targetDepartments', JSON.stringify(policyForm.targetDepartments));
      formData.append('targetRoles', JSON.stringify(policyForm.targetRoles));

      if (selectedPdfFile) {
        formData.append('pdf', selectedPdfFile);
      }

      if (editingPolicyId) {
        formData.append('changeSummary', policyForm.changeSummary);
        await api.put(`/policies/${editingPolicyId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success(
          'Policy updated to new version. Previous PDF and signatures preserved. New assignments created.'
        );
      } else {
        await api.post('/policies', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Company policy and PDF published. Assignments created for all active employees.');
      }

      setShowEditModal(false);
      setSelectedPdfFile(null);
      fetchPolicies();
    } catch (err) {
      console.error('Error saving policy:', err);
      toast.error(err.response?.data?.message || 'Failed to save policy.');
    } finally {
      setSavingPolicy(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Update Status (Publish, Archive, Draft)
  // -------------------------------------------------------------------------
  const handleStatusChange = async (policyId, newStatus) => {
    try {
      await api.patch(`/policies/${policyId}/status`, { status: newStatus });
      toast.success(`Policy status changed to ${newStatus}. Notifications sent to employees.`);
      fetchPolicies();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.');
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Delete Policy
  // -------------------------------------------------------------------------
  const handleDeletePolicy = async (policy) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${policy.title}"?`)) {
      return;
    }
    try {
      await api.delete(`/policies/${policy._id}`);
      toast.success(`Policy "${policy.title}" deleted.`);
      fetchPolicies();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete policy.');
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: Open Version History Modal (Admin only)
  // -------------------------------------------------------------------------
  const handleOpenHistory = async (policy) => {
    setHistoryModalPolicy(policy);
    setSelectedHistoryVersion(null);
    try {
      setLoadingHistory(true);
      const res = await api.get(`/policies/${policy._id}/versions`);
      if (res.data?.success) {
        setHistoryData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load policy version history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <MainLayout
      title="Company Policies & Compliance"
      subtitle="Official policy documents, PDF distribution, electronic signature acknowledgement, and compliance tracking."
    >
      <div className="container-fluid px-0">
        {/* Main Header Row */}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
          <div>
            <h4 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
              <FiShield className="text-success" />
              Policy PDF Distribution & Acknowledgement
            </h4>
            <p className="text-muted small mb-0">
              One Planet Technologies compliance guidelines, authenticated PDF viewer, and drawn digital signature audit trail.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleOpenCreateModal}
                className="btn btn-success d-flex align-items-center gap-1.5 shadow-sm fw-semibold"
                style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
              >
                <FiPlus size={16} />
                Upload & Publish Policy PDF
              </button>
            )}
          </div>
        </div>

        {/* Top-Level Navigation Tabs */}
        <div className="d-flex align-items-center gap-2 border-bottom pb-2 mb-4 overflow-auto">
          <button
            onClick={() => setActiveMainTab('policies')}
            className={`btn btn-sm d-flex align-items-center gap-2 rounded-pill px-3 py-1.5 ${
              activeMainTab === 'policies'
                ? 'btn-success fw-semibold text-white shadow-sm'
                : 'btn-outline-secondary'
            }`}
            style={
              activeMainTab === 'policies'
                ? { backgroundColor: '#0F5132', borderColor: '#0F5132' }
                : {}
            }
          >
            <FiBookOpen size={15} />
            {isAdmin ? 'Policies & Documents' : 'Policy Documents'}
          </button>

          {isAdmin ? (
            <>
              <button
                onClick={() => setActiveMainTab('reports')}
                className={`btn btn-sm d-flex align-items-center gap-2 rounded-pill px-3 py-1.5 ${
                  activeMainTab === 'reports'
                    ? 'btn-success fw-semibold text-white shadow-sm'
                    : 'btn-outline-secondary'
                }`}
                style={
                  activeMainTab === 'reports'
                    ? { backgroundColor: '#0F5132', borderColor: '#0F5132' }
                    : {}
                }
              >
                <FiFileText size={15} />
                Acknowledgement Dashboard
              </button>

              <button
                onClick={() => setActiveMainTab('questions')}
                className={`btn btn-sm d-flex align-items-center gap-2 rounded-pill px-3 py-1.5 ${
                  activeMainTab === 'questions'
                    ? 'btn-success fw-semibold text-white shadow-sm'
                    : 'btn-outline-secondary'
                }`}
                style={
                  activeMainTab === 'questions'
                    ? { backgroundColor: '#0F5132', borderColor: '#0F5132' }
                    : {}
                }
              >
                <FiMessageSquare size={15} />
                Employee Questions
                {centralQuestions.filter((q) => q.status === 'Open').length > 0 && (
                  <span className="badge bg-danger rounded-pill px-1.5 py-0.5" style={{ fontSize: '0.68rem' }}>
                    {centralQuestions.filter((q) => q.status === 'Open').length}
                  </span>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveMainTab('my-questions')}
              className={`btn btn-sm d-flex align-items-center gap-2 rounded-pill px-3 py-1.5 ${
                activeMainTab === 'my-questions'
                  ? 'btn-success fw-semibold text-white shadow-sm'
                  : 'btn-outline-secondary'
              }`}
              style={
                activeMainTab === 'my-questions'
                  ? { backgroundColor: '#0F5132', borderColor: '#0F5132' }
                  : {}
              }
            >
              <FiHelpCircle size={15} />
              My Questions & Inquiries
            </button>
          )}
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: POLICIES CATALOG & DOCUMENTS GRID                              */}
        {/* ===================================================================== */}
        {activeMainTab === 'policies' && (
          <>
            {/* KPI Cards Row */}
            <div className="row g-3 mb-4">
              {isAdmin ? (
                <>
                  <div className="col-12 col-sm-6 col-xl-3">
                    <div className="opt-card p-3 d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 p-2.5 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: '#EBF7EE', color: '#0F5132' }}
                      >
                        <FiBookOpen size={22} />
                      </div>
                      <div>
                        <div className="text-muted small fw-medium">Total Policies</div>
                        <h4 className="fw-bold text-dark mb-0">{metrics.total}</h4>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                          {metrics.published} published • {metrics.drafts} drafts
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-3">
                    <div className="opt-card p-3 d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 p-2.5 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: '#ECFDF5', color: '#059669' }}
                      >
                        <FiCheckCircle size={22} />
                      </div>
                      <div>
                        <div className="text-muted small fw-medium">Active Policies</div>
                        <h4 className="fw-bold text-dark mb-0">{metrics.published}</h4>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                          Assigned to active employees
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-3">
                    <div className="opt-card p-3 d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 p-2.5 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
                      >
                        <FiUsers size={22} />
                      </div>
                      <div>
                        <div className="text-muted small fw-medium">Overall Compliance</div>
                        <h4 className="fw-bold text-primary mb-0">{metrics.companyComplianceRate}%</h4>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                          Signed digital acknowledgements
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-3">
                    <div className="opt-card p-3 d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 p-2.5 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}
                      >
                        <FiMessageSquare size={22} />
                      </div>
                      <div>
                        <div className="text-muted small fw-medium">Employee Questions</div>
                        <h4 className="fw-bold text-dark mb-0">
                          {centralQuestions.filter((q) => q.status === 'Open').length} Open
                        </h4>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                          {centralQuestions.length} total questions
                        </small>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-12 col-sm-6 col-xl-3">
                    <div className="opt-card p-3 d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 p-2.5 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: '#EBF7EE', color: '#0F5132' }}
                      >
                        <FiBookOpen size={22} />
                      </div>
                      <div>
                        <div className="text-muted small fw-medium">Assigned Policies</div>
                        <h4 className="fw-bold text-dark mb-0">{policies.length}</h4>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                          Total company policies
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-3">
                    <div className="opt-card p-3 d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 p-2.5 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
                      >
                        <FiClock size={22} />
                      </div>
                      <div>
                        <div className="text-muted small fw-medium">Not Opened</div>
                        <h4 className="fw-bold text-danger mb-0">{metrics.notOpenedCount}</h4>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                          Unopened documents
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-3">
                    <div className="opt-card p-3 d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 p-2.5 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}
                      >
                        <FiEye size={22} />
                      </div>
                      <div>
                        <div className="text-muted small fw-medium">Opened (Pending Sign)</div>
                        <h4 className="fw-bold text-warning mb-0">{metrics.openedCount}</h4>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                          Requires drawn signature
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-3">
                    <div className="opt-card p-3 d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 p-2.5 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: '#ECFDF5', color: '#059669' }}
                      >
                        <FiCheckCircle size={22} />
                      </div>
                      <div>
                        <div className="text-muted small fw-medium">Acknowledged</div>
                        <h4 className="fw-bold text-success mb-0">{metrics.acknowledgedCount}</h4>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                          Signed & confirmed
                        </small>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div className="opt-card p-3 mb-4">
              <div className="row g-2 align-items-center">
                <div className="col-12 col-md-4">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white border-end-0">
                      <FiSearch className="text-muted" />
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder="Search policies by title or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="All">All Categories</option>
                    {PRESET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {isAdmin ? (
                  <div className="col-12 col-sm-6 col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="All">All Statuses</option>
                      <option value="Published">Published</option>
                      <option value="Draft">Draft</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                ) : (
                  <div className="col-12 col-sm-6 col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={employeeStatusFilter}
                      onChange={(e) => setEmployeeStatusFilter(e.target.value)}
                    >
                      <option value="All">All Policies</option>
                      <option value="Not Opened">Not Opened</option>
                      <option value="Opened">Opened (Pending Signature)</option>
                      <option value="Acknowledged">Acknowledged</option>
                    </select>
                  </div>
                )}

                <div className="col-12 col-md-2 text-md-end text-muted small">
                  Showing {displayedPolicies.length} {displayedPolicies.length === 1 ? 'policy' : 'policies'}
                </div>
              </div>
            </div>

            {/* Policies Cards Grid */}
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status"></div>
                <p className="text-muted small mt-2">Loading policy documents...</p>
              </div>
            ) : displayedPolicies.length === 0 ? (
              <div className="opt-card p-5 text-center">
                <FiFileText size={42} className="text-muted mb-3 opacity-50" />
                <h5 className="fw-semibold text-dark">No Policies Found</h5>
                <p className="text-muted small mb-3">
                  {searchQuery || selectedCategory !== 'All'
                    ? 'No policies match your search or filter criteria.'
                    : 'No policies have been assigned yet.'}
                </p>
                {isAdmin && (
                  <button
                    onClick={handleOpenCreateModal}
                    className="btn btn-sm btn-success"
                    style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                  >
                    <FiPlus size={14} className="me-1" /> Upload First Policy PDF
                  </button>
                )}
              </div>
            ) : (
              <div className="row g-3">
                {displayedPolicies.map((policy) => {
                  return (
                    <div key={policy._id} className="col-12 col-lg-6">
                      <div className="opt-card p-4 h-100 d-flex flex-column justify-content-between position-relative shadow-sm">
                        {/* Top Metadata */}
                        <div>
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <div className="d-flex flex-wrap align-items-center gap-1.5">
                              <span
                                className="badge bg-light text-dark border small fw-medium"
                                style={{ fontSize: '0.72rem' }}
                              >
                                <FiTag size={10} className="me-1 text-muted" />
                                {policy.category}
                              </span>

                              <span
                                className="badge bg-dark text-white small"
                                style={{ fontSize: '0.72rem' }}
                              >
                                v{policy.version}
                              </span>

                              {policy.hasPdf && (
                                <span
                                  className="badge bg-danger bg-opacity-10 text-danger border border-danger small d-flex align-items-center gap-1"
                                  style={{ fontSize: '0.72rem' }}
                                >
                                  <FiFile size={10} /> PDF Document
                                </span>
                              )}

                              {isAdmin && (
                                <span
                                  className={`badge small ${
                                    policy.status === 'Published'
                                      ? 'bg-success text-white'
                                      : policy.status === 'Draft'
                                      ? 'bg-warning text-dark'
                                      : 'bg-secondary text-white'
                                  }`}
                                  style={{ fontSize: '0.72rem' }}
                                >
                                  {policy.status}
                                </span>
                              )}
                            </div>

                            {/* User Acknowledgement Badge */}
                            {!isAdmin && (
                              <div>
                                {policy.statusForUser === 'Acknowledged' ? (
                                  <span
                                    className="badge bg-success bg-opacity-10 text-success border border-success d-flex align-items-center gap-1"
                                    style={{ fontSize: '0.72rem' }}
                                  >
                                    <FiCheck size={12} /> Acknowledged
                                  </span>
                                ) : policy.statusForUser === 'Opened' ? (
                                  <span
                                    className="badge bg-warning bg-opacity-15 text-warning border border-warning d-flex align-items-center gap-1"
                                    style={{ fontSize: '0.72rem' }}
                                  >
                                    <FiEye size={12} /> Opened (Sign Pending)
                                  </span>
                                ) : (
                                  <span
                                    className="badge bg-danger bg-opacity-10 text-danger border border-danger d-flex align-items-center gap-1"
                                    style={{ fontSize: '0.72rem' }}
                                  >
                                    <FiClock size={12} /> Not Opened
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Policy Title */}
                          <h5 className="fw-bold text-dark mb-1" style={{ fontSize: '1.05rem' }}>
                            <Link to={`/policies/${policy._id}`} className="text-dark text-decoration-none">
                              {policy.title}
                            </Link>
                          </h5>

                          {/* Description */}
                          <p
                            className="text-muted small mb-3"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.5,
                              fontSize: '0.82rem',
                            }}
                          >
                            {policy.description || policy.content || 'Official company compliance document.'}
                          </p>

                          {/* Meta Details: Effective Date & Publication Date */}
                          <div className="d-flex flex-wrap align-items-center gap-3 text-muted small mb-3 pb-2 border-bottom">
                            <span className="d-flex align-items-center gap-1" style={{ fontSize: '0.74rem' }}>
                              <FiCalendar size={12} />
                              Effective: {new Date(policy.effectiveDate).toLocaleDateString()}
                            </span>
                            {policy.publishedAt && (
                              <span className="d-flex align-items-center gap-1" style={{ fontSize: '0.74rem' }}>
                                <FiClock size={12} />
                                Published: {new Date(policy.publishedAt).toLocaleDateString()}
                              </span>
                            )}
                            {policy.hasPdf && policy.pdfName && (
                              <span className="d-flex align-items-center gap-1 text-truncate" style={{ fontSize: '0.74rem', maxWidth: 180 }}>
                                <FiFile size={11} className="text-danger" />
                                {policy.pdfName}
                              </span>
                            )}
                          </div>

                          {/* Compliance Bar for Admin */}
                          {isAdmin && policy.complianceStats && (
                            <div className="mb-3 p-2 bg-light rounded border">
                              <div className="d-flex justify-content-between align-items-center small mb-1">
                                <span className="fw-semibold text-dark" style={{ fontSize: '0.75rem' }}>
                                  Assigned Compliance:
                                </span>
                                <span className="fw-bold text-success" style={{ fontSize: '0.75rem' }}>
                                  {policy.complianceStats.acknowledgedCount} /{' '}
                                  {policy.complianceStats.totalAssigned} (
                                  {policy.complianceStats.compliancePercentage}%)
                                </span>
                              </div>
                              <div className="progress" style={{ height: 6 }}>
                                <div
                                  className="progress-bar bg-success"
                                  role="progressbar"
                                  style={{
                                    width: `${policy.complianceStats.compliancePercentage}%`,
                                    backgroundColor: '#0F5132',
                                  }}
                                ></div>
                              </div>
                              <div className="d-flex justify-content-between align-items-center mt-1 text-muted" style={{ fontSize: '0.7rem' }}>
                                <span>{policy.complianceStats.notOpenedCount} Not Opened</span>
                                <span>{policy.complianceStats.openedNotAcknowledgedCount} Opened</span>
                                <span className="text-success fw-medium">{policy.complianceStats.acknowledgedCount} Signed</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card Actions Footer */}
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2 border-top">
                          <Link
                            to={`/policies/${policy._id}`}
                            className={`btn btn-sm d-flex align-items-center gap-1.5 fw-semibold ${
                              policy.statusForUser === 'Acknowledged'
                                ? 'btn-outline-success'
                                : 'btn-success text-white'
                            }`}
                            style={
                              policy.statusForUser !== 'Acknowledged'
                                ? { backgroundColor: '#0F5132', borderColor: '#0F5132' }
                                : {}
                            }
                          >
                            <FiEye size={14} />
                            View & Acknowledge
                          </Link>

                          {isAdmin && (
                            <div className="d-flex align-items-center gap-1 flex-wrap">
                              <button
                                onClick={() => {
                                  setSelectedReportPolicyId(policy._id);
                                  setActiveMainTab('reports');
                                }}
                                className="btn btn-sm btn-outline-primary py-1 px-2 d-flex align-items-center gap-1"
                                style={{ fontSize: '0.75rem' }}
                                title="View Acknowledgement Tracking Report"
                              >
                                <FiFileText size={12} />
                                Report
                              </button>

                              <button
                                onClick={() => handleOpenHistory(policy)}
                                className="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center gap-1"
                                style={{ fontSize: '0.75rem' }}
                                title="View Version Snapshots"
                              >
                                <FiRotateCcw size={12} />
                                v{policy.version}
                              </button>

                              <button
                                onClick={() => handleOpenEditModal(policy)}
                                className="btn btn-sm btn-light border py-1 px-2"
                                title="Edit Policy / Upload New PDF"
                              >
                                <FiEdit2 size={13} className="text-secondary" />
                              </button>

                              <div className="dropdown d-inline-block">
                                <button
                                  className="btn btn-sm btn-light border py-1 px-2 dropdown-toggle"
                                  type="button"
                                  data-bs-toggle="dropdown"
                                  style={{ fontSize: '0.74rem' }}
                                >
                                  Status
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end shadow-sm small">
                                  {policy.status !== 'Published' && (
                                    <li>
                                      <button
                                        className="dropdown-item text-success"
                                        onClick={() => handleStatusChange(policy._id, 'Published')}
                                      >
                                        <FiCheck size={13} className="me-1.5" /> Publish to Employees
                                      </button>
                                    </li>
                                  )}
                                  {policy.status !== 'Draft' && (
                                    <li>
                                      <button
                                        className="dropdown-item text-warning"
                                        onClick={() => handleStatusChange(policy._id, 'Draft')}
                                      >
                                        <FiEdit2 size={13} className="me-1.5" /> Move to Draft
                                      </button>
                                    </li>
                                  )}
                                  {policy.status !== 'Archived' && (
                                    <li>
                                      <button
                                        className="dropdown-item text-secondary"
                                        onClick={() => handleStatusChange(policy._id, 'Archived')}
                                      >
                                        <FiArchive size={13} className="me-1.5" /> Archive Policy
                                      </button>
                                    </li>
                                  )}
                                  <li>
                                    <hr className="dropdown-divider" />
                                  </li>
                                  <li>
                                    <button
                                      className="dropdown-item text-danger"
                                      onClick={() => handleDeletePolicy(policy)}
                                    >
                                      <FiTrash2 size={13} className="me-1.5" /> Delete Policy
                                    </button>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: SECTION 4 - ADMIN ACKNOWLEDGEMENT TRACKING DASHBOARD           */}
        {/* ===================================================================== */}
        {activeMainTab === 'reports' && isAdmin && (
          <div className="space-y-4">
            {/* Report Header & Policy Selector */}
            <div className="opt-card p-4 mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: 520 }}>
                  <label className="fw-semibold text-dark small mb-0 text-nowrap">Select Policy:</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedReportPolicyId}
                    onChange={(e) => {
                      setSelectedReportPolicyId(e.target.value);
                      fetchAcknowledgementReport(e.target.value);
                    }}
                  >
                    {policies.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.title} (v{p.version} - {p.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    onClick={handleSendReminders}
                    disabled={sendingReminders || !selectedReportPolicyId}
                    className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1.5 shadow-sm fw-medium"
                  >
                    <FiBell size={14} />
                    {sendingReminders ? 'Sending Reminders...' : 'Send Reminder to Pending'}
                  </button>

                  <button
                    onClick={handleExportCSV}
                    disabled={!reportData || !reportData.report?.length}
                    className="btn btn-sm btn-success d-flex align-items-center gap-1.5 shadow-sm fw-semibold"
                    style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                  >
                    <FiDownload size={14} />
                    Export as CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Report KPI Summary */}
            {reportData?.stats && (
              <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl">
                  <div className="opt-card p-3 text-center">
                    <span className="text-muted small fw-medium d-block">Total Assigned</span>
                    <span className="fs-4 fw-bold text-dark">{reportData.stats.totalAssigned}</span>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-xl">
                  <div className="opt-card p-3 text-center">
                    <span className="text-muted small fw-medium d-block">Not Opened</span>
                    <span className="fs-4 fw-bold text-danger">{reportData.stats.notOpenedCount}</span>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-xl">
                  <div className="opt-card p-3 text-center">
                    <span className="text-muted small fw-medium d-block">Opened (Unsigned)</span>
                    <span className="fs-4 fw-bold text-warning">{reportData.stats.openedNotAcknowledgedCount}</span>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-xl">
                  <div className="opt-card p-3 text-center">
                    <span className="text-muted small fw-medium d-block">Acknowledged</span>
                    <span className="fs-4 fw-bold text-success">{reportData.stats.acknowledgedCount}</span>
                    <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                      {reportData.stats.completionPercentage}% completed
                    </small>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-xl">
                  <div className="opt-card p-3 text-center">
                    <span className="text-muted small fw-medium d-block">Pending Total</span>
                    <span className="fs-4 fw-bold text-secondary">{reportData.stats.pendingCount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Report Table Filters */}
            <div className="opt-card p-3 mb-3">
              <div className="row g-2 align-items-center">
                <div className="col-12 col-md-4">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white border-end-0">
                      <FiSearch className="text-muted" />
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder="Search by employee name or ID..."
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') fetchAcknowledgementReport();
                      }}
                    />
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={reportDeptFilter}
                    onChange={(e) => setReportDeptFilter(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={reportStatusFilter}
                    onChange={(e) => setReportStatusFilter(e.target.value)}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Not Opened">Not Opened</option>
                    <option value="Opened">Opened (Unsigned)</option>
                    <option value="Acknowledged">Acknowledged</option>
                    <option value="Pending">All Pending</option>
                  </select>
                </div>

                <div className="col-12 col-md-2 text-md-end">
                  <button
                    onClick={() => fetchAcknowledgementReport()}
                    className="btn btn-sm btn-outline-secondary w-100"
                  >
                    <FiFilter size={13} className="me-1" /> Apply Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Acknowledgement Report Data Table */}
            <div className="opt-card p-0 overflow-hidden shadow-sm">
              {loadingReport ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-success" role="status"></div>
                  <p className="text-muted small mt-2">Loading acknowledgement report & signature records...</p>
                </div>
              ) : !reportData || reportData.report?.length === 0 ? (
                <div className="text-center py-5 text-muted small">
                  No employee records matched the selected criteria.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                    <thead className="bg-light">
                      <tr>
                        <th className="ps-4 py-3">Employee Name</th>
                        <th className="py-3">Employee ID</th>
                        <th className="py-3">Department</th>
                        <th className="py-3">Policy Status</th>
                        <th className="py-3">First Opened</th>
                        <th className="py-3">Acknowledged On</th>
                        <th className="py-3 pe-4 text-center">Signature Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.report.map((r) => (
                        <tr key={r._id}>
                          <td className="ps-4 py-3">
                            <div className="fw-semibold text-dark">{r.user.fullName}</div>
                            <small className="text-muted">{r.user.email}</small>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border">{r.user.employeeId}</span>
                          </td>
                          <td>
                            <span className="text-secondary">{r.user.department}</span>
                          </td>
                          <td>
                            {r.status === 'Acknowledged' && (
                              <span className="badge bg-success bg-opacity-10 text-success border border-success px-2 py-1">
                                Acknowledged
                              </span>
                            )}
                            {r.status === 'Opened' && (
                              <span className="badge bg-warning bg-opacity-15 text-warning border border-warning px-2 py-1">
                                Opened (Unsigned)
                              </span>
                            )}
                            {r.status === 'Not Opened' && (
                              <span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-2 py-1">
                                Not Opened
                              </span>
                            )}
                          </td>
                          <td>
                            {r.firstOpenedAt ? (
                              <span className="text-dark d-flex align-items-center gap-1">
                                <FiEye size={12} className="text-info" />
                                {new Date(r.firstOpenedAt).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted small">Not Opened</span>
                            )}
                          </td>
                          <td>
                            {r.acknowledgedAt ? (
                              <span className="text-success fw-medium d-flex align-items-center gap-1">
                                <FiCheckCircle size={13} />
                                {new Date(r.acknowledgedAt).toLocaleString()}
                              </span>
                            ) : (
                              <span className="badge bg-light text-muted border">Pending</span>
                            )}
                          </td>
                          <td className="pe-4 text-center">
                            {r.hasSignature ? (
                              <button
                                onClick={() =>
                                  setInspectingSignature({
                                    ...r,
                                    policyTitle: reportData.policyTitle,
                                    policyVersion: reportData.policyVersion,
                                  })
                                }
                                className="btn btn-sm btn-outline-success py-1 px-2.5 d-inline-flex align-items-center gap-1 fw-medium"
                                style={{ fontSize: '0.75rem' }}
                              >
                                <FiEye size={12} />
                                View Signature
                              </button>
                            ) : (
                              <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                No Signature
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

        {/* ===================================================================== */}
        {/* TAB 3: SECTION 5 - QUESTIONS & CLARIFICATIONS INBOX                   */}
        {/* ===================================================================== */}
        {(activeMainTab === 'questions' || activeMainTab === 'my-questions') && (
          <div className="space-y-4">
            {/* Filter toolbar */}
            <div className="opt-card p-3 mb-4">
              <div className="row g-2 align-items-center">
                <div className="col-12 col-md-5">
                  <select
                    className="form-select form-select-sm"
                    value={centralPolicyFilter}
                    onChange={(e) => setCentralPolicyFilter(e.target.value)}
                  >
                    <option value="All">All Policies</option>
                    {policies.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <select
                    className="form-select form-select-sm"
                    value={centralStatusFilter}
                    onChange={(e) => setCentralStatusFilter(e.target.value)}
                  >
                    <option value="All">All Questions</option>
                    <option value="Open">Open</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Answered">Answered</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div className="col-12 col-md-3 text-md-end text-muted small">
                  Showing {centralQuestions.length} {centralQuestions.length === 1 ? 'question' : 'questions'}
                </div>
              </div>
            </div>

            {/* Questions List */}
            {loadingCentralQuestions ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status"></div>
                <p className="text-muted small mt-2">Loading policy clarification inquiries...</p>
              </div>
            ) : centralQuestions.length === 0 ? (
              <div className="opt-card p-5 text-center">
                <FiMessageSquare size={38} className="text-muted mb-2 opacity-50" />
                <h6 className="fw-semibold text-dark">No Questions Found</h6>
                <p className="text-muted small mb-0">
                  {isAdmin
                    ? 'No employee questions have been submitted under the selected filters.'
                    : 'You have not submitted any questions yet. Open any policy document to submit questions.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {centralQuestions.map((q) => {
                  const isCurrentTarget = searchParams.get('questionId') === q._id;
                  return (
                    <div
                      key={q._id}
                      id={`admin-question-${q._id}`}
                      className={`opt-card p-4 shadow-sm mb-3 transition-all ${
                        isCurrentTarget ? 'border-2 border-success shadow' : ''
                      }`}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2 flex-wrap">
                        <div>
                          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                            <span className="badge bg-light text-dark border small">
                              Policy: {q.policy?.title || 'Policy Document'} (Version {q.policyVersion})
                            </span>
                            <span
                              className={`badge small ${
                                q.status === 'Open'
                                  ? 'bg-warning text-dark'
                                  : q.status === 'Resolved'
                                  ? 'bg-success text-white'
                                  : q.status === 'Answered'
                                  ? 'bg-primary text-white'
                                  : 'bg-secondary text-white'
                              }`}
                            >
                              {q.status}
                            </span>

                            {q.isFAQ && (
                              <span className="badge bg-info bg-opacity-10 text-primary border border-info small">
                                Shared FAQ
                              </span>
                            )}
                          </div>

                          {/* Employee Name, ID and Department info */}
                          <div className="d-flex align-items-center gap-2 text-muted small flex-wrap" style={{ fontSize: '0.78rem' }}>
                            <span className="fw-semibold text-dark">
                              {q.user?.fullName || 'Employee'}
                            </span>
                            <span>• ID: <strong>{q.user?.employeeId || q.employeeId || 'N/A'}</strong></span>
                            <span>• Dept: <strong>{q.user?.department?.name || q.user?.department || 'General'}</strong></span>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          {isAdmin && (
                            <>
                              {q.status !== 'Resolved' ? (
                                <button
                                  onClick={() => handleUpdateQuestionStatus(q.policy?._id, q._id, 'Resolved')}
                                  className="btn btn-sm btn-success py-1 px-2.5 d-flex align-items-center gap-1.5 fw-semibold"
                                  style={{ fontSize: '0.75rem', backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                                  title="Mark as Resolved"
                                >
                                  <FiCheckCircle size={13} /> Mark Resolved
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUpdateQuestionStatus(q.policy?._id, q._id, 'Open')}
                                  className="btn btn-sm btn-outline-warning py-1 px-2.5 d-flex align-items-center gap-1.5 fw-semibold"
                                  style={{ fontSize: '0.75rem' }}
                                  title="Reopen Question"
                                >
                                  <FiRotateCcw size={13} /> Reopen Question
                                </button>
                              )}

                              {/* Status Dropdown */}
                              <div className="d-flex align-items-center">
                                <select
                                  id={`question-status-${q._id}`}
                                  aria-label="Question Status"
                                  className={`form-select form-select-sm fw-semibold py-1 px-2 ${
                                    q.status === 'Open'
                                      ? 'border-warning text-dark bg-warning-subtle'
                                      : q.status === 'Answered'
                                      ? 'border-primary text-primary bg-primary-subtle'
                                      : 'border-success text-success bg-success-subtle'
                                  }`}
                                  style={{
                                    fontSize: '0.75rem',
                                    width: 'auto',
                                    minWidth: '115px',
                                    cursor: 'pointer',
                                    height: '31px',
                                  }}
                                  value={q.status || 'Open'}
                                  disabled={updatingStatusId === q._id}
                                  onChange={(e) =>
                                    handleUpdateQuestionStatus(
                                      q.policy?._id || q.policy,
                                      q._id,
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="Open">Open</option>
                                  <option value="Answered">Answered</option>
                                  <option value="Resolved">Resolved</option>
                                </select>
                              </div>

                              {/* Toggle Shared FAQ */}
                              <button
                                type="button"
                                onClick={() => handleToggleFAQ(q.policy?._id || q.policy, q._id)}
                                className={`btn btn-sm py-1 px-2 d-flex align-items-center gap-1 fw-semibold ${
                                  q.isFAQ ? 'btn-info text-white' : 'btn-outline-secondary'
                                }`}
                                style={{ fontSize: '0.72rem', height: '31px' }}
                                title={q.isFAQ ? 'Remove from Shared FAQ' : 'Publish as Shared FAQ'}
                              >
                                {q.isFAQ ? 'Shared FAQ' : '+ FAQ'}
                              </button>
                            </>
                          )}
                          <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                            {new Date(q.createdAt).toLocaleString()}
                          </small>
                        </div>
                      </div>

                    {/* Question Subject & Content */}
                    <div className="p-3 bg-light rounded-3 border mb-3">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="fw-bold small text-dark">
                          {q.title || 'Clarification Request'}
                        </span>
                        <span className="text-muted small">
                          • Asked by {q.user?.fullName} ({q.user?.employeeId})
                        </span>
                      </div>
                      <p className="mb-0 text-dark small" style={{ lineHeight: 1.6 }}>
                        {q.question}
                      </p>
                    </div>

                    {/* Threaded Replies */}
                    {q.replies && q.replies.length > 0 && (
                      <div className="ps-3 border-start border-3 ms-2 mb-3 space-y-2">
                        {q.replies.map((reply) => (
                          <div
                            key={reply._id}
                            className={`p-2.5 rounded-3 mb-2 border ${
                              reply.role === 'Admin'
                                ? 'bg-success bg-opacity-10 border-success'
                                : 'bg-white border'
                            }`}
                          >
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-semibold small text-dark d-flex align-items-center gap-1.5">
                                <FiCornerDownRight size={12} className="text-muted" />
                                {reply.user?.fullName || 'User'}
                                <span
                                  className={`badge ${
                                    reply.role === 'Admin' ? 'bg-success text-white' : 'bg-light text-dark border'
                                  }`}
                                  style={{ fontSize: '0.65rem' }}
                                >
                                  {reply.role === 'Admin' ? 'Admin / HR' : 'Employee Follow-up'}
                                </span>
                              </span>
                              <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                {new Date(reply.createdAt).toLocaleString()}
                              </small>
                            </div>
                            <p className="mb-0 text-dark small ps-3" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                              {reply.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input Form */}
                    <div className="d-flex gap-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder={
                          isAdmin
                            ? 'Type reply as Admin/HR to employee...'
                            : 'Type follow-up clarification to Admin...'
                        }
                        value={centralReplyTexts[q._id] || ''}
                        onChange={(e) =>
                          setCentralReplyTexts({ ...centralReplyTexts, [q._id]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleReplyQuestion(
                              q.policy?._id,
                              q._id,
                              centralReplyTexts[q._id] || '',
                              true
                            );
                          }
                        }}
                      />
                      <button
                        onClick={() =>
                          handleReplyQuestion(
                            q.policy?._id,
                            q._id,
                            centralReplyTexts[q._id] || '',
                            true
                          )
                        }
                        disabled={submittingReplyId === q._id || !centralReplyTexts[q._id]?.trim()}
                        className="btn btn-sm btn-success text-nowrap d-flex align-items-center gap-1"
                        style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                      >
                        <FiSend size={13} />
                        {submittingReplyId === q._id ? 'Posting...' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 1: POLICY READER, PDF VIEWER & DRAWN SIGNATURE ACKNOWLEDGEMENT      */}
        {/* ========================================================================= */}
        {readerPolicy && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)', overflowY: 'auto' }}
          >
            <div
              className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
              style={{ maxHeight: '90vh', margin: '1.5rem auto' }}
            >
              <div
                className="modal-content shadow-lg border-0 rounded-3 d-flex flex-column"
                style={{ maxHeight: '90vh', height: '100%', overflow: 'hidden' }}
              >
                {/* Modal Header */}
                <div className="modal-header bg-light py-3 px-4 border-bottom flex-shrink-0">
                  <div className="flex-grow-1 me-3">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="badge bg-white text-secondary border small">
                        <FiTag size={11} className="me-1 text-muted" />
                        {readerPolicy.category}
                      </span>
                      <span className="badge bg-dark text-white small">
                        Version {readerPolicy.version}
                      </span>
                      {readerPolicy.hasPdf && (
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger small">
                          <FiFile size={10} className="me-1" /> PDF Document
                        </span>
                      )}
                    </div>
                    <h5 className="modal-title fw-bold text-dark mb-0">{readerPolicy.title}</h5>
                    <small className="text-muted" style={{ fontSize: '0.76rem' }}>
                      Effective Date: {new Date(readerPolicy.effectiveDate).toLocaleDateString()}
                    </small>

                    {/* Sub-Tabs: Document vs Questions */}
                    <div className="d-flex gap-2 mt-2 pt-1">
                      <button
                        onClick={() => setReaderActiveTab('document')}
                        className={`btn btn-sm py-0.5 px-3 rounded-pill ${
                          readerActiveTab === 'document'
                            ? 'btn-success fw-semibold text-white'
                            : 'btn-outline-secondary'
                        }`}
                        style={
                          readerActiveTab === 'document'
                            ? { backgroundColor: '#0F5132', borderColor: '#0F5132', fontSize: '0.75rem' }
                            : { fontSize: '0.75rem' }
                        }
                      >
                        <FiFileText size={12} className="me-1" /> Document & Signature
                      </button>

                      <button
                        onClick={() => setReaderActiveTab('questions')}
                        className={`btn btn-sm py-0.5 px-3 rounded-pill ${
                          readerActiveTab === 'questions'
                            ? 'btn-success fw-semibold text-white'
                            : 'btn-outline-secondary'
                        }`}
                        style={
                          readerActiveTab === 'questions'
                            ? { backgroundColor: '#0F5132', borderColor: '#0F5132', fontSize: '0.75rem' }
                            : { fontSize: '0.75rem' }
                        }
                      >
                        <FiMessageSquare size={12} className="me-1" />
                        Questions & Clarifications ({readerQuestions.length})
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setReaderPolicy(null)}
                  ></button>
                </div>

                {/* Modal Body: Document & Signature Tab */}
                {readerActiveTab === 'document' ? (
                  <div
                    className="modal-body p-4"
                    style={{
                      backgroundColor: '#FCFDFE',
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehavior: 'contain',
                    }}
                  >
                    {/* Policy Description Summary Banner */}
                    {readerPolicy.description && (
                      <div className="p-3 bg-light rounded-3 border mb-3">
                        <span className="fw-semibold text-dark small d-block mb-1">
                          Overview & Purpose:
                        </span>
                        <p className="mb-0 text-muted small" style={{ lineHeight: 1.5 }}>
                          {readerPolicy.description}
                        </p>
                      </div>
                    )}

                    {/* PDF Viewer or Content Reader */}
                    {readerPolicy.hasPdf ? (
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="fw-semibold text-dark small d-flex align-items-center gap-1.5">
                            <FiFile className="text-danger" />
                            Official Policy PDF Document
                          </span>
                          {pdfBlobUrl && (
                            <a
                              href={pdfBlobUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-sm btn-link text-success p-0 d-flex align-items-center gap-1"
                              style={{ fontSize: '0.75rem' }}
                            >
                              <FiExternalLink size={12} /> Open in New Tab
                            </a>
                          )}
                        </div>

                        {loadingPdf ? (
                          <div className="pdf-viewer-container d-flex flex-column align-items-center justify-content-center text-white">
                            <div className="spinner-border text-light mb-2" role="status"></div>
                            <span className="small">Loading secure PDF document...</span>
                          </div>
                        ) : pdfBlobUrl ? (
                          <iframe
                            src={pdfBlobUrl}
                            title="Policy PDF Document"
                            className="w-100 rounded border shadow-sm"
                            style={{ height: '520px', minHeight: '400px', backgroundColor: '#525659' }}
                          />
                        ) : (
                          <div className="p-4 text-center bg-light rounded border text-muted small">
                            PDF document could not be loaded. Please check your connection or contact IT support.
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Fallback for Text-based policies */
                      <div className="mb-4">
                        <div
                          className="p-4 bg-white rounded-3 border shadow-sm"
                          style={{
                            lineHeight: 1.7,
                            fontSize: '0.92rem',
                            color: '#1E293B',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'inherit',
                          }}
                        >
                          {readerPolicy.content}
                        </div>
                      </div>
                    )}

                    {/* SECTION 3: DRAWN DIGITAL SIGNATURE & ACKNOWLEDGEMENT */}
                    <div className="pt-3 border-top">
                      <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                        <FiEdit2 className="text-success" />
                        Electronic Policy Acknowledgement & Drawn Signature
                      </h6>

                      {readerPolicy.statusForUser === 'Acknowledged' ? (
                        /* Already Acknowledged Confirmation State */
                        <div className="p-4 bg-success bg-opacity-10 border border-success rounded-3">
                          <div className="d-flex align-items-center gap-2 text-success fw-bold mb-2">
                            <FiCheckCircle size={20} />
                            <span>
                              You electronically signed and acknowledged Version {readerPolicy.version} on{' '}
                              {new Date(readerPolicy.acknowledgedAt).toLocaleString()}.
                            </span>
                          </div>
                          <p className="small text-dark mb-3" style={{ fontStyle: 'italic' }}>
                            "{readerPolicy.myStatement || 'I confirm that I have read and understood this company policy and agree to follow the applicable guidelines.'}"
                          </p>

                          {readerPolicy.mySignature && (
                            <div className="mt-2">
                              <span className="text-muted small fw-medium d-block mb-1">
                                Recorded Drawn Signature:
                              </span>
                              <div className="p-2 bg-white rounded border d-inline-block shadow-sm">
                                <img
                                  src={readerPolicy.mySignature}
                                  alt="Recorded Signature"
                                  style={{ maxHeight: 60, display: 'block' }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="mt-3 text-muted small" style={{ fontSize: '0.72rem' }}>
                            Internal Organization Electronic Acknowledgement • One Planet Technologies Compliance Portal
                          </div>
                        </div>
                      ) : (
                        /* Pending Signature State */
                        <div className="p-3 bg-white rounded-3 border shadow-sm">
                          {/* Mandatory Statement Checkbox */}
                          <div className="form-check mb-3">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="acknowledgementCheckbox"
                              checked={hasAgreedCheckbox}
                              onChange={(e) => setHasAgreedCheckbox(e.target.checked)}
                            />
                            <label
                              className="form-check-label text-dark small fw-semibold"
                              htmlFor="acknowledgementCheckbox"
                              style={{ cursor: 'pointer', lineHeight: 1.5 }}
                            >
                              I confirm that I have read and understood this company policy and agree to follow the applicable guidelines. <span className="text-danger">*</span>
                            </label>
                          </div>

                          {/* Digital Signature Drawing Pad */}
                          <SignaturePad
                            onChange={(sig) => setSignatureData(sig)}
                            disabled={acknowledging}
                          />

                          <div className="mt-3 text-muted" style={{ fontSize: '0.72rem' }}>
                            <FiInfo className="me-1 text-secondary" />
                            <strong>Electronic Signature Notice:</strong> This drawn electronic signature represents your formal internal acknowledgement and confirmation of compliance with One Planet Technologies operating standards.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Modal Body: Questions & Clarifications Tab */
                  <div
                    className="modal-body p-4"
                    style={{
                      backgroundColor: '#FCFDFE',
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehavior: 'contain',
                    }}
                  >
                    {/* Ask Question Box */}
                    <div className="p-3 bg-white rounded-3 border shadow-sm mb-4">
                      <h6 className="fw-semibold text-dark mb-1 d-flex align-items-center gap-1.5">
                        <FiHelpCircle className="text-success" />
                        Ask a Question or Request Clarification
                      </h6>
                      <p className="text-muted small mb-2">
                        Questions are private between you and authorized Admin/HR staff unless published as an FAQ.
                      </p>
                      <form onSubmit={handleAskQuestion}>
                        <input
                          type="text"
                          className="form-control form-control-sm mb-2"
                          placeholder="Question Subject (e.g. Work From Home Schedule)"
                          value={newQuestionTitle}
                          onChange={(e) => setNewQuestionTitle(e.target.value)}
                        />
                        <textarea
                          className="form-control form-control-sm mb-2"
                          rows={3}
                          placeholder="Type your detailed question regarding this policy..."
                          value={newQuestionMessage}
                          onChange={(e) => setNewQuestionMessage(e.target.value)}
                          required
                        />
                        <div className="text-end">
                          <button
                            type="submit"
                            disabled={submittingQuestion || !newQuestionMessage.trim()}
                            className="btn btn-sm btn-success fw-medium d-inline-flex align-items-center gap-1"
                            style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                          >
                            <FiSend size={13} />
                            {submittingQuestion ? 'Submitting...' : 'Submit Question'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Questions History */}
                    <h6 className="fw-bold text-dark small mb-2">
                      {isAdmin ? 'Employee Inquiries on this Policy' : 'Your Inquiries on this Policy'}
                    </h6>

                    {loadingReaderQuestions ? (
                      <div className="text-center py-4">
                        <div className="spinner-border spinner-border-sm text-success" role="status"></div>
                        <p className="text-muted small mt-1">Loading inquiries...</p>
                      </div>
                    ) : readerQuestions.length === 0 ? (
                      <div className="text-center py-4 bg-white rounded border text-muted small">
                        No questions submitted yet for this policy.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {readerQuestions.map((q) => (
                          <div key={q._id} className="p-3 bg-white rounded-3 border shadow-sm mb-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <span className="fw-semibold text-dark small">{q.title}</span>
                                <span className="text-muted small ms-2">
                                  by {q.user?.fullName} ({q.user?.employeeId})
                                </span>
                                <span
                                  className={`badge ms-2 small ${
                                    q.status === 'Open'
                                      ? 'bg-warning text-dark'
                                      : q.status === 'Resolved'
                                      ? 'bg-success text-white'
                                      : q.status === 'Answered'
                                      ? 'bg-primary text-white'
                                      : 'bg-secondary text-white'
                                  }`}
                                  style={{ fontSize: '0.68rem' }}
                                >
                                  {q.status}
                                </span>
                              </div>
                              <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                {new Date(q.createdAt).toLocaleString()}
                              </small>
                            </div>

                            <p className="small text-dark mb-2" style={{ lineHeight: 1.5 }}>
                              {q.question}
                            </p>

                            {/* Replies */}
                            {q.replies && q.replies.length > 0 && (
                              <div className="ps-2 border-start border-2 ms-1 my-2">
                                {q.replies.map((reply) => (
                                  <div
                                    key={reply._id}
                                    className={`p-2 rounded mb-1.5 ${
                                      reply.role === 'Admin'
                                        ? 'bg-success bg-opacity-10 border border-success'
                                        : 'bg-light border'
                                    }`}
                                  >
                                    <div className="d-flex justify-content-between align-items-center">
                                      <span className="fw-semibold small text-dark" style={{ fontSize: '0.76rem' }}>
                                        {reply.user?.fullName}{' '}
                                        <span className="badge bg-secondary" style={{ fontSize: '0.62rem' }}>
                                          {reply.role}
                                        </span>
                                      </span>
                                      <small className="text-muted" style={{ fontSize: '0.66rem' }}>
                                        {new Date(reply.createdAt).toLocaleTimeString()}
                                      </small>
                                    </div>
                                    <p className="mb-0 text-dark small" style={{ fontSize: '0.78rem' }}>
                                      {reply.message}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply Input */}
                            <div className="d-flex gap-2 mt-2">
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder={
                                  isAdmin ? 'Reply as Admin...' : 'Ask follow-up clarification...'
                                }
                                value={followUpTexts[q._id] || ''}
                                onChange={(e) =>
                                  setFollowUpTexts({ ...followUpTexts, [q._id]: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleReplyQuestion(
                                      readerPolicy._id,
                                      q._id,
                                      followUpTexts[q._id] || '',
                                      false
                                    );
                                  }
                                }}
                              />
                              <button
                                onClick={() =>
                                  handleReplyQuestion(
                                    readerPolicy._id,
                                    q._id,
                                    followUpTexts[q._id] || '',
                                    false
                                  )
                                }
                                disabled={
                                  submittingReplyId === q._id || !followUpTexts[q._id]?.trim()
                                }
                                className="btn btn-sm btn-outline-success text-nowrap"
                              >
                                {submittingReplyId === q._id ? 'Posting...' : 'Reply'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Footer: Action Buttons */}
                <div className="modal-footer bg-light py-2.5 px-4 border-top d-flex justify-content-between align-items-center flex-wrap gap-2 flex-shrink-0">
                  <div className="text-muted small">
                    {readerPolicy.statusForUser === 'Acknowledged' ? (
                      <span className="text-success fw-medium d-flex align-items-center gap-1">
                        <FiCheckCircle size={14} /> Acknowledged with Drawn Digital Signature
                      </span>
                    ) : (
                      <span>Step 2 of 2: Confirm statement and draw signature to submit</span>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary px-3"
                      onClick={() => setReaderPolicy(null)}
                    >
                      Close
                    </button>

                    {readerPolicy.statusForUser === 'Acknowledged' ? (
                      <Link
                        to={`/policies/${readerPolicy._id}`}
                        className="btn btn-sm btn-success px-3 fw-semibold d-flex align-items-center gap-1.5"
                        style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                      >
                        <FiEye size={14} /> View & Download Signed PDF
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          !hasAgreedCheckbox ||
                          !signatureData.hasSignature ||
                          acknowledging
                        }
                        onClick={() => handleSubmitAcknowledgement(readerPolicy._id)}
                        className="btn btn-sm btn-success px-3 fw-semibold d-flex align-items-center gap-1.5 shadow-sm"
                        style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                      >
                        {acknowledging ? (
                          <>
                            <div className="spinner-border spinner-border-sm me-1" role="status"></div>
                            Embedding Signature into PDF...
                          </>
                        ) : (
                          <>
                            <FiCheckCircle size={15} /> Submit & Sign
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: CREATE / EDIT POLICY MODAL (ADMIN ONLY) - WITH PDF UPLOAD        */}
        {/* ========================================================================= */}
        {showEditModal && isAdmin && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)', overflowY: 'auto' }}
          >
            <div
              className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
              style={{ maxHeight: '88vh', margin: '1.75rem auto' }}
            >
              <div
                className="modal-content shadow-lg border-0 rounded-3 d-flex flex-column"
                style={{ maxHeight: '88vh', height: '100%', overflow: 'hidden' }}
              >
                <form
                  onSubmit={handleSavePolicy}
                  className="d-flex flex-column flex-grow-1"
                  style={{ maxHeight: '88vh', minHeight: 0, overflow: 'hidden' }}
                >
                  <div className="modal-header bg-light py-3 px-4 border-bottom flex-shrink-0">
                    <div>
                      <h5 className="modal-title fw-bold text-dark mb-0">
                        {editingPolicyId ? 'Edit Company Policy Document' : 'Upload & Publish Policy PDF'}
                      </h5>
                      <small className="text-muted" style={{ fontSize: '0.76rem' }}>
                        {editingPolicyId
                          ? 'Updating this policy preserves the previous PDF and records, incrementing to a new version.'
                          : 'Distribute official organizational policies to all active employee accounts.'}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowEditModal(false)}
                    ></button>
                  </div>

                  <div
                    className="modal-body p-4"
                    style={{
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehavior: 'contain',
                    }}
                  >
                    {editingPolicyId && (
                      <div className="alert alert-info py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                        <FiRotateCcw size={16} />
                        <span>
                          <strong>Version Control Active:</strong> Saving changes will archive Version{' '}
                          {policies.find((p) => p._id === editingPolicyId)?.version} into history and create new assignment requirements.
                        </span>
                      </div>
                    )}

                    <div className="row g-3">
                      {/* PDF File Upload Field */}
                      <div className="col-12">
                        <label className="form-label small fw-semibold text-dark mb-1 d-flex align-items-center gap-1.5">
                          <FiUploadCloud className="text-success" />
                          Upload Policy PDF Document {editingPolicyId ? '(Leave empty to keep existing)' : ''}
                        </label>
                        <div className="p-3 bg-light rounded-3 border">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="form-control form-control-sm mb-2"
                            onChange={handlePdfFileSelect}
                          />
                          <div className="d-flex justify-content-between align-items-center text-muted" style={{ fontSize: '0.72rem' }}>
                            <span>Supported: PDF documents (.pdf) up to 25 MB</span>
                            {selectedPdfFile && (
                              <button
                                type="button"
                                onClick={() => {
                                  const tempUrl = URL.createObjectURL(selectedPdfFile);
                                  setPdfPreviewModalUrl(tempUrl);
                                }}
                                className="btn btn-sm btn-link text-success p-0"
                              >
                                Preview Uploaded PDF
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Policy Title */}
                      <div className="col-12">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Policy Title <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. Code of Business Conduct & Ethics Policy 2026"
                          value={policyForm.title}
                          onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })}
                          required
                        />
                      </div>

                      {/* Policy Description */}
                      <div className="col-12">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Policy Description / Summary
                        </label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          placeholder="Provide a clear summary of policy objectives and employee responsibilities..."
                          value={policyForm.description}
                          onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })}
                        />
                      </div>

                      {/* Category Selection */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Category <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={policyForm.category}
                          onChange={(e) => setPolicyForm({ ...policyForm, category: e.target.value })}
                          required
                        >
                          {PRESET_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="Other">Custom Category...</option>
                        </select>

                        {policyForm.category === 'Other' && (
                          <input
                            type="text"
                            className="form-control form-control-sm mt-2"
                            placeholder="Enter custom category name"
                            value={policyForm.customCategory}
                            onChange={(e) => setPolicyForm({ ...policyForm, customCategory: e.target.value })}
                            required
                          />
                        )}
                      </div>

                      {/* Effective Date */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Effective Date <span className="text-danger">*</span>
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={policyForm.effectiveDate}
                          onChange={(e) => setPolicyForm({ ...policyForm, effectiveDate: e.target.value })}
                          required
                        />
                      </div>

                      {/* Target Audience Scope */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Target Audience Scope
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={policyForm.targetAudience}
                          onChange={(e) => setPolicyForm({ ...policyForm, targetAudience: e.target.value })}
                        >
                          <option value="All">All Active Employee Accounts (Company-Wide)</option>
                          <option value="Departments">Specific Departments</option>
                          <option value="Roles">Specific Roles</option>
                        </select>
                      </div>

                      {/* Initial Status (On creation) */}
                      {!editingPolicyId && (
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Status <span className="text-danger">*</span>
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={policyForm.status}
                            onChange={(e) => setPolicyForm({ ...policyForm, status: e.target.value })}
                          >
                            <option value="Published">Publish Now (Assigns to all active employees)</option>
                            <option value="Draft">Save as Draft (Admin only)</option>
                          </select>
                        </div>
                      )}

                      {/* Revision summary if editing */}
                      {editingPolicyId && (
                        <div className="col-12">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Change Summary / Revision Notes
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Updated Section 3 for 2026 compliance guidelines"
                            value={policyForm.changeSummary}
                            onChange={(e) => setPolicyForm({ ...policyForm, changeSummary: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="modal-footer bg-light py-2 px-4 border-top flex-shrink-0">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setShowEditModal(false)}
                      disabled={savingPolicy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-sm btn-success fw-semibold"
                      disabled={savingPolicy}
                      style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                    >
                      {savingPolicy ? (
                        <>
                          <div className="spinner-border spinner-border-sm me-1" role="status"></div>
                          Uploading & Publishing...
                        </>
                      ) : editingPolicyId ? (
                        'Save Revision & Increment Version'
                      ) : (
                        'Save & Publish Policy PDF'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 4: SIGNATURE INSPECTOR MODAL (ADMIN ONLY)                          */}
        {/* ========================================================================= */}
        {inspectingSignature && isAdmin && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(3px)' }}
          >
            <div className="modal-dialog modal-md modal-dialog-centered">
              <div className="modal-content shadow-lg border-0 rounded-3">
                <div className="modal-header bg-light py-3 px-4 border-bottom">
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0">
                      Digital Signature Record
                    </h5>
                    <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                      Authenticated Electronic Acknowledgement Verification
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setInspectingSignature(null)}
                  ></button>
                </div>

                <div className="modal-body p-4">
                  {/* Employee Details Card */}
                  <div className="p-3 bg-light rounded-3 border mb-3">
                    <div className="row g-2 small">
                      <div className="col-6">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Employee Name:</span>
                        <strong className="text-dark">{inspectingSignature.user?.fullName}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Employee ID:</span>
                        <strong className="text-dark">{inspectingSignature.user?.employeeId}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Department:</span>
                        <span className="text-dark">{inspectingSignature.user?.department}</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Policy Version:</span>
                        <span className="badge bg-dark text-white">v{inspectingSignature.policyVersion}</span>
                      </div>
                    </div>
                  </div>

                  {/* Drawn Signature Image */}
                  <div className="mb-3 text-center">
                    <span className="text-muted small fw-medium d-block mb-1.5 text-start">
                      Drawn Electronic Signature:
                    </span>
                    <div className="p-3 bg-white rounded-3 border shadow-sm">
                      <img
                        src={inspectingSignature.signatureImage}
                        alt="Drawn Signature"
                        style={{ maxWidth: '100%', maxHeight: 90, display: 'block', margin: '0 auto' }}
                      />
                    </div>
                  </div>

                  {/* Confirmed Statement */}
                  <div className="p-2.5 bg-success bg-opacity-10 border border-success rounded mb-3">
                    <span className="fw-semibold text-success small d-block mb-1">
                      Confirmed Statement:
                    </span>
                    <p className="mb-0 text-dark small" style={{ fontSize: '0.78rem', fontStyle: 'italic' }}>
                      "{inspectingSignature.statement}"
                    </p>
                  </div>

                  {/* Audit Metadata */}
                  <div className="text-muted small" style={{ fontSize: '0.72rem', lineHeight: 1.6 }}>
                    <div>
                      <strong>Signed At:</strong>{' '}
                      {new Date(inspectingSignature.acknowledgedAt).toLocaleString()}
                    </div>
                    {inspectingSignature.ipAddress && (
                      <div>
                        <strong>IP Address:</strong> {inspectingSignature.ipAddress}
                      </div>
                    )}
                    <div>
                      <strong>Type:</strong> Internal Drawn Electronic Signature
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2 px-4 border-top d-flex justify-content-between align-items-center">
                  {selectedReportPolicyId ? (
                    <Link
                      to={`/policies/${selectedReportPolicyId}`}
                      className="btn btn-sm btn-outline-success d-flex align-items-center gap-1.5 fw-semibold"
                      style={{ fontSize: '0.78rem' }}
                    >
                      <FiEye size={13} /> View Full Policy & Signed PDF
                    </Link>
                  ) : <span></span>}
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

        {/* ========================================================================= */}
        {/* MODAL 5: PDF PREVIEW MODAL (FOR ADMIN BEFORE SAVING)                      */}
        {/* ========================================================================= */}
        {pdfPreviewModalUrl && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(3px)' }}
          >
            <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxHeight: '90vh' }}>
              <div className="modal-content shadow-lg border-0 rounded-3">
                <div className="modal-header bg-light py-2 px-3 border-bottom">
                  <h6 className="modal-title fw-bold text-dark mb-0">PDF Document Preview</h6>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      URL.revokeObjectURL(pdfPreviewModalUrl);
                      setPdfPreviewModalUrl(null);
                    }}
                  ></button>
                </div>
                <div className="modal-body p-0" style={{ height: '70vh' }}>
                  <iframe
                    src={pdfPreviewModalUrl}
                    title="PDF Preview"
                    className="w-100 h-100 border-0"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: VERSION HISTORY & PRESERVED VERSIONS (ADMIN ONLY)                */}
        {/* ========================================================================= */}
        {historyModalPolicy && isAdmin && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', overflowY: 'auto' }}
          >
            <div
              className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
              style={{ maxHeight: '88vh', margin: '1.75rem auto' }}
            >
              <div
                className="modal-content shadow-lg border-0 rounded-3 d-flex flex-column"
                style={{ maxHeight: '88vh', height: '100%', overflow: 'hidden' }}
              >
                <div className="modal-header bg-light py-3 px-4 border-bottom flex-shrink-0">
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0">
                      Version History: {historyModalPolicy.title}
                    </h5>
                    <small className="text-muted" style={{ fontSize: '0.76rem' }}>
                      Current Version: v{historyData?.currentVersion || 1} • Audit trail of all prior policy revisions.
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setHistoryModalPolicy(null)}
                  ></button>
                </div>

                <div
                  className="modal-body p-4"
                  style={{
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                  }}
                >
                  {loadingHistory ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-success" role="status"></div>
                      <p className="text-muted small mt-2">Loading version history...</p>
                    </div>
                  ) : historyData?.versionHistory?.length === 0 ? (
                    <div className="alert alert-light border text-center py-4">
                      <FiRotateCcw size={28} className="text-muted mb-2" />
                      <h6 className="fw-semibold text-dark">This is the Initial Version (v1)</h6>
                      <p className="text-muted small mb-0">
                        No previous revisions exist for this policy. Whenever an Admin edits the policy, a snapshot is preserved here.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="timeline-container mb-3">
                        {historyData?.versionHistory?.map((item) => (
                          <div
                            key={item._id}
                            className="p-3 bg-white rounded-3 border mb-3 shadow-sm d-flex justify-content-between align-items-start gap-3"
                          >
                            <div>
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <span className="badge bg-secondary text-white small">
                                  Version {item.version}
                                </span>
                                <span className="badge bg-light text-dark border small">
                                  {item.category}
                                </span>
                                <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                  Archived on {new Date(item.savedAt).toLocaleString()}
                                </small>
                              </div>
                              <h6 className="fw-bold text-dark mb-1">{item.title}</h6>
                              {item.changeSummary && (
                                <p className="text-muted small mb-1" style={{ fontSize: '0.78rem' }}>
                                  <strong>Revision notes:</strong> {item.changeSummary}
                                </p>
                              )}
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                Archived by: {item.updatedBy?.fullName || 'Admin'}
                              </small>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setSelectedHistoryVersion(
                                  selectedHistoryVersion?.version === item.version ? null : item
                                )
                              }
                              className="btn btn-sm btn-outline-secondary py-1 px-2"
                              style={{ fontSize: '0.74rem' }}
                            >
                              {selectedHistoryVersion?.version === item.version
                                ? 'Hide Snapshot'
                                : 'Inspect Details'}
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Inspected Content Snapshot Drawer */}
                      {selectedHistoryVersion && (
                        <div className="p-3 bg-light rounded-3 border">
                          <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                            <span className="fw-bold small text-dark">
                              Snapshot of Version {selectedHistoryVersion.version}: {selectedHistoryVersion.title}
                            </span>
                            <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                              Effective: {new Date(selectedHistoryVersion.effectiveDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div
                            className="p-3 bg-white rounded border small"
                            style={{
                              maxHeight: 220,
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              fontSize: '0.82rem',
                            }}
                          >
                            {selectedHistoryVersion.description || selectedHistoryVersion.content || 'Attached PDF document.'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light py-2 px-4 border-top flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setHistoryModalPolicy(null)}
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

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FiEdit3, FiRotateCcw, FiCheck, FiInfo } from 'react-icons/fi';

/**
 * Responsive Digital Signature Drawing Pad
 * Supports Mouse, Touchscreen, and Stylus using standard HTML5 Canvas & Pointer Events.
 */
export const SignaturePad = ({
  onChange,
  width = 520,
  height = 160,
  strokeColor = '#0F5132',
  strokeWidth = 2.5,
  disabled = false,
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState('');
  const [strokePointsCount, setStrokePointsCount] = useState(0);

  // Initialize Canvas with High-DPI support
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set display size
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;

    // Compute actual dimensions based on parent or fixed width
    const rect = canvas.getBoundingClientRect();
    const actualWidth = rect.width || width;

    canvas.width = actualWidth * dpr;
    canvas.height = height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
  }, [width, height, strokeColor, strokeWidth]);

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, [initCanvas]);

  // Coordinates helper
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Pointer Down (Mouse click, Touch start, Stylus contact)
  const handlePointerDown = (e) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);

    setIsDrawing(true);
    setStrokePointsCount((prev) => prev + 1);
  };

  // Pointer Move (Mouse drag, Touch drag, Stylus drag)
  const handlePointerMove = (e) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();

    setStrokePointsCount((prev) => prev + 1);
  };

  // Pointer Up / End
  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (strokePointsCount > 2) {
      const dataUrl = canvas.toDataURL('image/png');
      setHasSignature(true);
      setSignaturePreview(dataUrl);
      if (onChange) {
        onChange({ hasSignature: true, dataUrl });
      }
    }
  };

  // Clear Canvas
  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    setHasSignature(false);
    setSignaturePreview('');
    setStrokePointsCount(0);

    if (onChange) {
      onChange({ hasSignature: false, dataUrl: '' });
    }
  };

  return (
    <div className="signature-pad-container">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <label className="form-label small fw-semibold text-dark mb-0 d-flex align-items-center gap-1.5">
          <FiEdit3 className="text-success" />
          Drawn Digital Signature <span className="text-danger">*</span>
        </label>
        <span className="text-muted" style={{ fontSize: '0.72rem' }}>
          Supports Mouse, Touchscreen & Stylus
        </span>
      </div>

      <div className="signature-canvas-wrapper shadow-sm">
        <canvas
          ref={canvasRef}
          className="signature-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <div className="signature-baseline-guide"></div>
        <div className="signature-baseline-label">
          ✕ Sign above this line using mouse or touch
        </div>
      </div>

      {/* Action Buttons & Status */}
      <div className="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasSignature && strokePointsCount === 0}
          className="btn btn-sm btn-outline-secondary py-1 px-2.5 d-flex align-items-center gap-1"
          style={{ fontSize: '0.78rem' }}
        >
          <FiRotateCcw size={12} />
          Clear Signature
        </button>

        {hasSignature ? (
          <span className="badge bg-success bg-opacity-10 text-success border border-success d-flex align-items-center gap-1 py-1 px-2">
            <FiCheck size={12} /> Signature captured & ready to submit
          </span>
        ) : (
          <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
            Please draw your signature above to enable submission.
          </span>
        )}
      </div>

      {/* Signature Preview Thumbnail */}
      {signaturePreview && (
        <div className="mt-2 p-2 bg-light rounded border d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-2 gap-sm-3">
          <div className="signature-preview-box">
            <img
              src={signaturePreview}
              alt="Signature Preview"
              style={{ maxWidth: '100%', maxHeight: 42, display: 'block' }}
            />
          </div>
          <small className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.4 }}>
            <strong>Internal Electronic Signature:</strong> Your drawn signature will be securely recorded
            along with your authenticated employee ID and timestamp.
          </small>
        </div>
      )}
    </div>
  );
};


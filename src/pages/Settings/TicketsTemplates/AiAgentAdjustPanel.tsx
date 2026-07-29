import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles, Wrench } from 'lucide-react';
import api from '../../../api';
import type { FieldMappingRequest } from './ExternalApiCallsEditor';
import './TestActionModal.css';

export interface AiAgentAdjustProposal {
  call: Record<string, unknown>;
  requestMappings: FieldMappingRequest[];
  sessionId: number;
}

interface Props {
  call: Record<string, unknown>;
  requestMappings: FieldMappingRequest[];
  sessionId: number | null;
  documentation: string;
  intent: string;
  ticketFields: { key: string; type: string }[];
  workflowFieldCatalog: { key: string; type: string }[];
  // Present (pre-filled by the caller) when this follows a failed test — absent when the admin is
  // just asking for a change at will (Step 3's standalone usage). Purely changes button copy/icon.
  error?: string;
  onApply: (fix: AiAgentAdjustProposal) => void;
}

/**
 * Shared "ask the AI to adjust this call" panel — POST /templates/ai-fix-call, continuing the
 * guided wizard's persisted session (sessionId) so the AI already has the original documentation/
 * intent/field-mapping context. Used standalone in Step 3 (Field Mapping, no error) and embedded in
 * TestActionModal after a failed test (Step 4, pre-filled error) — same endpoint, same proposal/
 * Apply UX either way, the caller decides which single call this operates on.
 */
export const AiAgentAdjustPanel = ({
  call, requestMappings, sessionId, documentation, intent, ticketFields, workflowFieldCatalog, error, onApply,
}: Props) => {
  const { t } = useTranslation();
  const [instructions, setInstructions] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const [proposal, setProposal] = useState<AiAgentAdjustProposal | null>(null);

  const runAsk = async () => {
    setAsking(true);
    setAskError('');
    setProposal(null);
    try {
      const res = await api.post('/templates/ai-fix-call', {
        sessionId: sessionId ?? null,
        documentation, intent,
        instructions,
        error: error ?? '',
        call,
        requestMappings,
        ticketFields,
        workflowFields: workflowFieldCatalog,
      });
      setProposal({
        call: res.data.call,
        requestMappings: res.data.fieldMappings?.request ?? [],
        sessionId: res.data.sessionId,
      });
    } catch (err: any) {
      setAskError(err?.response?.data?.message || t('awb_agent_failed', { defaultValue: 'Could not adjust this call.' }));
    } finally {
      setAsking(false);
    }
  };

  const apply = () => {
    if (!proposal) return;
    onApply(proposal);
    setProposal(null);
    setInstructions('');
  };

  return (
    <div className="tam-sec aap-panel">
      <div className="tam-sec-lbl">{t('awb_agent_panel_label', { defaultValue: 'ASK AI TO ADJUST THIS CALL' })}</div>
      <textarea
        className="wfd-inp tam-fix-instructions"
        value={instructions}
        onChange={e => setInstructions(e.target.value)}
        placeholder={t('awb_agent_instructions_placeholder', { defaultValue: "e.g. Use the customer's work email instead of their personal one" }) as string}
      />
      <button className="wfd-btn-ghost tam-fix-btn" onClick={runAsk} disabled={asking}>
        {asking
          ? <><Loader2 size={13} className="mte-spin" /> {t('awb_agent_asking_ellipsis', { defaultValue: 'Asking…' })}</>
          : error
            ? <><Wrench size={13} /> {t('test_action_fix_call_btn', { defaultValue: 'Fix with AI' })}</>
            : <><Sparkles size={13} /> {t('awb_agent_ask_btn', { defaultValue: 'Ask AI' })}</>}
      </button>
      {askError && <p className="tam-error-text">{askError}</p>}

      {proposal && (
        <div className="tam-proposal">
          <div className="tam-sec-lbl">{t('awb_agent_proposed_heading', { defaultValue: 'PROPOSED CHANGE' })}</div>
          <div className="tam-field-row">
            <span className="tam-field-key">{String(proposal.call.method ?? '')}</span>
            <span className="tam-captured-val">{String(proposal.call.urlTemplate ?? '')}</span>
          </div>
          {proposal.requestMappings.map((m, i) => (
            <div key={i} className="tam-field-row">
              <span className="tam-field-key">{`{{${m.placeholder}}}`}</span>
              <span className="tam-captured-val">→ {m.ticketField}</span>
            </div>
          ))}
          <button className="wfd-btn-save tam-apply-btn" onClick={apply}>
            {t('awb_agent_apply_btn', { defaultValue: 'Apply' })}
          </button>
        </div>
      )}
    </div>
  );
};

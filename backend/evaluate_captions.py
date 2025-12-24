import json
import argparse
from collections import Counter


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def align_inputs(preds, refs):
    """
    Accepts predictions and references in either of two forms:
    - list: preds = [s1, s2, ...], refs = [[r1a, r1b], [r2a, r2b], ...]
    - dict: preds = {id: s}, refs = {id: [r1, r2...]}
    Returns two lists: predictions, references (aligned by index)
    """
    if isinstance(preds, dict) and isinstance(refs, dict):
        ids = sorted(preds.keys())
        predictions = [preds[i] for i in ids]
        references = [refs.get(i, []) for i in ids]
        return predictions, references

    if isinstance(preds, list) and isinstance(refs, list):
        return preds, refs

    raise ValueError('predictions/refs must be both list or both dict')


def unigram_f1(pred, refs):
    pred_tokens = pred.lower().split()
    ref_counter = Counter()
    for r in refs:
        ref_counter.update(r.lower().split())
    pred_counter = Counter(pred_tokens)
    tp = sum(min(pred_counter[w], ref_counter.get(w, 0)) for w in pred_counter)
    prec = tp / sum(pred_counter.values()) if pred_counter else 0.0
    rec = tp / sum(ref_counter.values()) if ref_counter else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
    return prec, rec, f1


def micro_unigram_f1(preds, refs_list):
    # sum counts across dataset
    total_tp = 0
    total_pred = 0
    total_ref = 0
    for p, refs in zip(preds, refs_list):
        pred_tokens = p.lower().split()
        pred_counter = Counter(pred_tokens)
        ref_counter = Counter()
        for r in refs:
            ref_counter.update(r.lower().split())
        total_tp += sum(min(pred_counter[w], ref_counter.get(w, 0)) for w in pred_counter)
        total_pred += sum(pred_counter.values())
        total_ref += sum(ref_counter.values())
    prec = total_tp / total_pred if total_pred else 0.0
    rec = total_tp / total_ref if total_ref else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
    return {'precision': prec, 'recall': rec, 'f1': f1}


def main():
    parser = argparse.ArgumentParser(description='Evaluate image caption predictions')
    parser.add_argument('--pred', required=True, help='Predictions JSON path (list or dict)')
    parser.add_argument('--refs', required=True, help='References JSON path (list of list or dict)')
    parser.add_argument('--bert_model', default='distilroberta-base', help='Model name for BERTScore (default: distilroberta-base)')
    args = parser.parse_args()

    preds = load_json(args.pred)
    refs = load_json(args.refs)
    predictions, references = align_inputs(preds, refs)

    results = {}

    # Try to use NLGEval if available (legacy)
    try:
        from nlgeval import NLGEval

        nlgeval = NLGEval()
        metrics = nlgeval.compute_metrics(references, predictions)
        results['nlgeval'] = metrics
    except Exception as e:
        results['nlgeval_error'] = str(e)

    # Quick metrics using sacrebleu, nltk (METEOR), rouge-score, and bert-score
    try:
        import sacrebleu
        from rouge_score import rouge_scorer
        import nltk
        from bert_score import score as bert_score

        # Ensure NLKT data for METEOR
        try:
            nltk.data.find('corpora/wordnet')
        except LookupError:
            nltk.download('wordnet')
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')

        # Prepare references for sacrebleu: list of reference streams (one list per reference index)
        # sacrebleu expects: list_of_references where each element is a list of reference sentences
        list_of_refs = list(map(list, zip(*references))) if references and len(references[0]) > 0 else []
        try:
            bleu = sacrebleu.corpus_bleu(predictions, list_of_refs) if list_of_refs else None
            results.setdefault('sacrebleu', {})
            results['sacrebleu']['bleu'] = bleu.score if bleu is not None else None
        except Exception as e:
            results.setdefault('sacrebleu', {})['error'] = str(e)

        # METEOR - average across samples
        from nltk.translate.meteor_score import meteor_score
        meteor_vals = []
        for p, refs in zip(predictions, references):
            try:
                meteor_vals.append(meteor_score(refs, p))
            except Exception:
                meteor_vals.append(0.0)
        results['meteor'] = sum(meteor_vals) / len(meteor_vals) if meteor_vals else 0.0

        # ROUGE-L (use F1)
        scorer = rouge_scorer.RougeScorer(['rougeL'], use_stemmer=True)
        rouge_f1s = []
        for p, refs in zip(predictions, references):
            # compute against best reference by F1
            best = 0.0
            for r in refs:
                sc = scorer.score(r, p)['rougeL'].fmeasure
                if sc > best:
                    best = sc
            rouge_f1s.append(best)
        results['rougeL_f1'] = sum(rouge_f1s) / len(rouge_f1s) if rouge_f1s else 0.0

        # BERTScore (use first reference per sample for simplicity)
        try:
            refs_for_bert = [r[0] if isinstance(r, (list, tuple)) and r else '' for r in references]
            # use selected bert model (smaller default to avoid huge downloads)
            bert_model = args.bert_model if 'args' in locals() else 'distilroberta-base'
            P, R, F = bert_score(predictions, refs_for_bert, lang='en', model_type=bert_model, rescale_with_baseline=True)
            # F is a torch tensor
            results['bertscore_f1'] = float(F.mean().cpu().numpy())
            results['bertscore_model'] = bert_model
        except Exception as e:
            results['bertscore_error'] = str(e)
    except Exception as e:
        results['quick_metrics_error'] = str(e)

    # Unigram F1 (macro and micro)
    per_sample = []
    for p, r in zip(predictions, references):
        prec, rec, f1 = unigram_f1(p, r)
        per_sample.append({'precision': prec, 'recall': rec, 'f1': f1})
    # Macro average
    macro = {
        'precision': sum(x['precision'] for x in per_sample) / len(per_sample) if per_sample else 0.0,
        'recall': sum(x['recall'] for x in per_sample) / len(per_sample) if per_sample else 0.0,
        'f1': sum(x['f1'] for x in per_sample) / len(per_sample) if per_sample else 0.0,
    }
    micro = micro_unigram_f1(predictions, references)

    results['unigram'] = {'macro': macro, 'micro': micro}

    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()

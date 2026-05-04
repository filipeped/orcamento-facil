-- Add payment_terms and general_terms columns to proposal_settings
ALTER TABLE proposal_settings
ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT '• 50% no fechamento do contrato
• 50% na conclusão do serviço
• Formas: transferência ou dinheiro',
ADD COLUMN IF NOT EXISTS general_terms TEXT DEFAULT '• Garantia de 30 dias após a conclusão do serviço
• Materiais inclusos conforme especificado acima
• Prazo de execução a combinar após aprovação';

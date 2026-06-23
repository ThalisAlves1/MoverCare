import { z } from 'zod';

export const createCallSchema = z.object({
  patientCode: z.string().min(1, 'Informe o nome ou código do paciente'),
  bedNumber: z.string().min(1, 'Informe o número do leito'),

  originSectorId: z.string().min(1, 'Selecione o setor de origem'),
  destinationSectorId: z.string().min(1, 'Selecione o setor de destino'),

  transportType: z.enum(['MACA', 'CADEIRA_RODAS', 'ACOMPANHAMENTO', 'OUTRO'], {
    message: 'Selecione o tipo de transporte',
  }),

  priority: z.enum(['NORMAL', 'URGENTE', 'CRITICO'], {
    message: 'Selecione a prioridade',
  }),

  risk: z.enum(['BAIXO', 'MEDIO', 'ALTO'], {
    message: 'Selecione o risco',
  }),

  infectionPrecaution: z.enum(['PADRAO', 'CONTATO', 'GOTICULAS', 'AEROSSOIS', 'NAO_SE_APLICA'], {
    message: 'Selecione a precaução',
  }),

  destinationCommunicated: z.boolean(),
  teamConfirmed: z.boolean(),
  equipmentConfirmed: z.boolean(),

  observation: z.string().optional().default(''),
});

export type CreateCallSchemaData = z.infer<typeof createCallSchema>;

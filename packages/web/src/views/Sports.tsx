import {
  Box,
  Button,
  Heading,
  Stack,
  Text,
  Input,
  Textarea,
} from "@chakra-ui/react";
import { type FormEvent, useState } from "react";
import type { CreateSportRequest } from "@alentapp/shared";
import { Field } from "../components/ui/field";
import { sportsService } from "../services/sports";

const emptyForm: CreateSportRequest = {
  name: "",
  description: "",
  max_capacity: 1,
  additional_price: 0,
  requires_medical_certificate: false,
};

export function SportsView() {
  const [formData, setFormData] = useState<CreateSportRequest>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await sportsService.create(formData);
      setSuccessMessage("Deporte registrado correctamente.");
      setFormData(emptyForm);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al registrar el deporte";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      <Heading size="xl" mb="6">
        Registrar deporte
      </Heading>

      <Box maxW="lg">
        <form onSubmit={handleSubmit}>
          <Stack gap="4">
            {successMessage ? (
              <Text color="green.600" fontWeight="medium">
                {successMessage}
              </Text>
            ) : null}
            {error ? (
              <Text color="red.600" fontWeight="medium">
                {error}
              </Text>
            ) : null}

            <Field label="Nombre" required>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Natación"
              />
            </Field>

            <Field label="Descripción" required>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descripción del deporte"
                rows={4}
              />
            </Field>

            <Field label="Cupo máximo" required>
              <Input
                type="number"
                min={1}
                step={1}
                value={formData.max_capacity}
                onChange={(e) =>
                  setFormData({ ...formData, max_capacity: parseInt(e.target.value, 10) || 0 })
                }
              />
            </Field>

            <Field label="Precio adicional" required>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formData.additional_price}
                onChange={(e) =>
                  setFormData({ ...formData, additional_price: parseFloat(e.target.value) || 0 })
                }
              />
            </Field>

            <Field label="Requiere certificado médico">
              <input
                type="checkbox"
                checked={formData.requires_medical_certificate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    requires_medical_certificate: e.target.checked,
                  })
                }
              />
            </Field>

            <Button type="submit" colorPalette="blue" loading={isSubmitting}>
              Crear deporte
            </Button>
          </Stack>
        </form>
      </Box>
    </Box>
  );
}

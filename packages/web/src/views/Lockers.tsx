import {
  Box,
  Button,
  Heading,
  Stack,
  Text,
  Input,
} from "@chakra-ui/react";
import { type FormEvent, useState } from "react";
import type { CreateLockerRequest } from "@alentapp/shared";
import { Field } from "../components/ui/field";
import { lockersService } from "../services/lockers";

const emptyForm: CreateLockerRequest = {
  number: 0,
  location: "",
};

export function LockersView() {
  const [formData, setFormData] = useState<CreateLockerRequest>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await lockersService.create({
        number: Number(formData.number),
        location: formData.location,
      });
      setSuccessMessage(`Casillero #${formData.number} registrado correctamente.`);
      setFormData(emptyForm);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al registrar el casillero";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      <Heading size="xl" mb="6">
        Registrar Casillero
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

            <Field label="Número de casillero" required>
              <Input
                type="number"
                min={1}
                step={1}
                value={formData.number || ""}
                onChange={(e) =>
                  setFormData({ ...formData, number: parseInt(e.target.value, 10) || 0 })
                }
                placeholder="Ej: 101"
              />
            </Field>

            <Field label="Ubicación" required>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ej: Vestuario de hombres"
              />
            </Field>

            <Button type="submit" colorPalette="blue" loading={isSubmitting}>
              Crear casillero
            </Button>
          </Stack>
        </form>
      </Box>
    </Box>
  );
}

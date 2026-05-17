import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  Input,
  Textarea,
  Table,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { LuPencil, LuPlus, LuRefreshCw, LuTrash2 } from 'react-icons/lu';
import { type FormEvent, useEffect, useState } from 'react';
import type { CreateSportRequest, SportDTO } from '@alentapp/shared';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogActionTrigger,
  DialogCloseTrigger,
} from '../components/ui/dialog';
import { Field } from '../components/ui/field';
import { sportsService } from '../services/sports';

const initialFormState = (): CreateSportRequest => ({
  name: '',
  description: '',
  max_capacity: 1,
  additional_price: 0,
  requires_medical_certificate: false,
});

export function SportsView() {
  const [sports, setSports] = useState<SportDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateSportRequest>(initialFormState());

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSport, setEditingSport] = useState<SportDTO | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editMaxCapacity, setEditMaxCapacity] = useState(1);
  const [editAdditionalPrice, setEditAdditionalPrice] = useState(0);
  const [editRequiresCertificate, setEditRequiresCertificate] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [deletingSportId, setDeletingSportId] = useState<string | null>(null);

  const fetchSports = async (options?: { clearSuccess?: boolean }) => {
    if (options?.clearSuccess) {
      setSuccessMessage(null);
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await sportsService.getAll();
      setSports(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar los deportes';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setFormData(initialFormState());
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (sport: SportDTO) => {
    setEditingSport(sport);
    setEditDescription(sport.description);
    setEditMaxCapacity(sport.max_capacity);
    setEditAdditionalPrice(sport.additional_price);
    setEditRequiresCertificate(sport.requires_medical_certificate);
    setEditFormError(null);
    setIsEditOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      await sportsService.create(formData);
      setSuccessMessage('Deporte registrado correctamente.');
      setFormData(initialFormState());
      setIsCreateOpen(false);
      await fetchSports();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'No se pudo registrar el deporte. Intente nuevamente.';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSport) return;
    setIsEditSubmitting(true);
    setEditFormError(null);
    try {
      await sportsService.update(editingSport.id, {
        description: editDescription,
        max_capacity: editMaxCapacity,
        additional_price: editAdditionalPrice,
        requires_medical_certificate: editRequiresCertificate,
      });
      setSuccessMessage('Deporte actualizado correctamente.');
      setIsEditOpen(false);
      setEditingSport(null);
      await fetchSports();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'No se pudo actualizar el deporte. Intente nuevamente.';
      setEditFormError(message);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDeleteSport = async (sport: SportDTO) => {
    const confirmed = window.confirm(
      `¿Confirmás la baja del deporte "${sport.name}"? Esta acción no elimina los datos históricos; el deporte dejará de mostrarse en el listado.`,
    );
    if (!confirmed) return;

    setDeletingSportId(sport.id);
    setError(null);
    try {
      await sportsService.delete(sport.id);
      setSuccessMessage('Deporte dado de baja correctamente.');
      await fetchSports();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'No se pudo dar de baja el deporte. Intente nuevamente.';
      setError(message);
    } finally {
      setDeletingSportId(null);
    }
  };

  useEffect(() => {
    fetchSports();
  }, []);

  return (
    <>
      <DialogRoot open={isCreateOpen} onOpenChange={(e) => setIsCreateOpen(e.open)}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Registrar nuevo deporte</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Stack gap="4">
                {formError ? (
                  <Text color="red.600" fontWeight="medium">
                    {formError}
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
                      setFormData({
                        ...formData,
                        additional_price: parseFloat(e.target.value) || 0,
                      })
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
              </Stack>
            </DialogBody>
            <DialogFooter>
              <DialogActionTrigger asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogActionTrigger>
              <Button type="submit" colorPalette="blue" loading={isSubmitting}>
                Crear deporte
              </Button>
            </DialogFooter>
            <DialogCloseTrigger />
          </form>
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={isEditOpen}
        onOpenChange={(e) => {
          setIsEditOpen(e.open);
          if (!e.open) {
            setEditingSport(null);
            setEditFormError(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Editar deporte</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Stack gap="4">
                {editFormError ? (
                  <Text color="red.600" fontWeight="medium">
                    {editFormError}
                  </Text>
                ) : null}
                {editingSport ? (
                  <Field label="Nombre">
                    <Input value={editingSport.name} readOnly />
                  </Field>
                ) : null}

                <Field label="Descripción" required>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Breve descripción del deporte"
                    rows={4}
                  />
                </Field>

                <Field label="Cupo máximo" required>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={editMaxCapacity}
                    onChange={(e) =>
                      setEditMaxCapacity(parseInt(e.target.value, 10) || 0)
                    }
                  />
                </Field>

                <Field label="Precio adicional" required>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editAdditionalPrice}
                    onChange={(e) =>
                      setEditAdditionalPrice(parseFloat(e.target.value) || 0)
                    }
                  />
                </Field>

                <Field label="Requiere certificado médico">
                  <input
                    type="checkbox"
                    checked={editRequiresCertificate}
                    onChange={(e) => setEditRequiresCertificate(e.target.checked)}
                  />
                </Field>
              </Stack>
            </DialogBody>
            <DialogFooter>
              <DialogActionTrigger asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogActionTrigger>
              <Button type="submit" colorPalette="blue" loading={isEditSubmitting}>
                Guardar cambios
              </Button>
            </DialogFooter>
            <DialogCloseTrigger />
          </form>
        </DialogContent>
      </DialogRoot>

      <Stack gap="8">
        <Flex justify="space-between" align="center">
          <Stack gap="1">
            <Heading size="2xl" fontWeight="bold">
              Administración de Deportes
            </Heading>
            <Text color="fg.muted" fontSize="md">
              Consultá el catálogo vigente del club y registrá nuevas disciplinas cuando corresponda.
            </Text>
          </Stack>
          <HStack gap="3">
            <Button variant="outline" onClick={() => fetchSports({ clearSuccess: true })} disabled={isLoading}>
              <LuRefreshCw /> Actualizar
            </Button>
            <Button colorPalette="blue" size="md" onClick={openCreateModal}>
              <LuPlus /> Agregar Deporte
            </Button>
          </HStack>
        </Flex>

        {successMessage ? (
          <Box bg="green.50" borderWidth="1px" borderColor="green.200" borderRadius="md" p="4">
            <Text color="green.700" fontWeight="medium">
              {successMessage}
            </Text>
          </Box>
        ) : null}

        {error ? (
          <Box
            p="4"
            bg="red.50"
            color="red.700"
            borderRadius="md"
            border="1px solid"
            borderColor="red.200"
          >
            <Text fontWeight="bold">Error:</Text>
            <Text>{error}</Text>
          </Box>
        ) : null}

        <Box
          bg="bg.panel"
          borderRadius="xl"
          boxShadow="sm"
          borderWidth="1px"
          overflow="hidden"
          minH="300px"
          position="relative"
        >
          {isLoading ? (
            <Center h="300px">
              <Stack align="center" gap="4">
                <Spinner size="xl" color="blue.500" />
                <Text color="fg.muted">Cargando deportes...</Text>
              </Stack>
            </Center>
          ) : sports.length === 0 ? (
            <Center h="300px">
              <Stack align="center" gap="4">
                <Text color="fg.muted">No hay deportes activos en el catálogo.</Text>
                <Button variant="ghost" onClick={() => fetchSports({ clearSuccess: true })}>
                  Reintentar
                </Button>
              </Stack>
            </Center>
          ) : (
            <Table.Root size="md" variant="line" interactive>
              <Table.Header>
                <Table.Row bg="bg.muted/50">
                  <Table.ColumnHeader py="4">Nombre</Table.ColumnHeader>
                  <Table.ColumnHeader py="4">Descripción</Table.ColumnHeader>
                  <Table.ColumnHeader py="4">Cupo máximo</Table.ColumnHeader>
                  <Table.ColumnHeader py="4">Precio adicional</Table.ColumnHeader>
                  <Table.ColumnHeader py="4">Certificado médico</Table.ColumnHeader>
                  <Table.ColumnHeader py="4" textAlign="end">
                    Acciones
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sports.map((sport) => (
                  <Table.Row key={sport.id} _hover={{ bg: 'bg.muted/30' }}>
                    <Table.Cell fontWeight="semibold" color="fg.emphasized">
                      {sport.name}
                    </Table.Cell>
                    <Table.Cell color="fg.muted" maxW="xs">
                      <Text lineClamp={3}>{sport.description}</Text>
                    </Table.Cell>
                    <Table.Cell>{sport.max_capacity}</Table.Cell>
                    <Table.Cell>${sport.additional_price.toFixed(2)}</Table.Cell>
                    <Table.Cell>
                      {sport.requires_medical_certificate ? (
                        <Box
                          display="inline-block"
                          px="2"
                          py="0.5"
                          borderRadius="md"
                          bg="orange.50"
                          color="orange.800"
                          fontSize="xs"
                          fontWeight="bold"
                        >
                          Sí
                        </Box>
                      ) : (
                        <Box
                          display="inline-block"
                          px="2"
                          py="0.5"
                          borderRadius="md"
                          bg="gray.50"
                          color="gray.600"
                          fontSize="xs"
                          fontWeight="bold"
                        >
                          No
                        </Box>
                      )}
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      <HStack gap="1" justify="flex-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(sport)}
                          disabled={deletingSportId !== null}
                        >
                          <LuPencil /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => void handleDeleteSport(sport)}
                          loading={deletingSportId === sport.id}
                          disabled={deletingSportId !== null && deletingSportId !== sport.id}
                        >
                          <LuTrash2 /> Dar de baja
                        </Button>
                      </HStack>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Stack>
    </>
  );
}

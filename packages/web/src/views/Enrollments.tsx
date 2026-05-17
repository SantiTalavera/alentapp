import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  Input,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { MemberDTO, SportDTO } from '@alentapp/shared';
import { Field } from '../components/ui/field';
import {
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  SelectContent,
  SelectItem,
  createListCollection,
} from '../components/ui/select';
import { enrollmentsService } from '../services/enrollments';
import { membersService } from '../services/members';
import { sportsService } from '../services/sports';

export function EnrollmentsView() {
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [sports, setSports] = useState<SportDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [memberId, setMemberId] = useState('');
  const [sportId, setSportId] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [enrollmentIdForVigencia, setEnrollmentIdForVigencia] = useState('');
  const [vigenciaError, setVigenciaError] = useState<string | null>(null);
  const [vigenciaSuccess, setVigenciaSuccess] = useState<string | null>(null);
  const [isUpdatingVigencia, setIsUpdatingVigencia] = useState(false);

  const memberCollection = useMemo(
    () =>
      createListCollection({
        items: members.map((m) => ({
          label: `${m.name} — DNI ${m.dni}`,
          value: m.id,
        })),
      }),
    [members]
  );

  const sportCollection = useMemo(
    () =>
      createListCollection({
        items: sports.map((s) => ({
          label: `${s.name} (cupo máx. ${s.max_capacity})`,
          value: s.id,
        })),
      }),
    [sports]
  );

  const loadData = async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const [membersData, sportsData] = await Promise.all([
        membersService.getAll(),
        sportsService.getAll(),
      ]);
      setMembers(membersData);
      setSports(sportsData);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar los datos';
      setListError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const created = await enrollmentsService.create({
        member_id: memberId,
        sport_id: sportId,
      });
      setSuccessMessage(
        `Inscripción registrada correctamente. Podés usar el ID para cambiar vigencia: ${created.id}.`
      );
      setEnrollmentIdForVigencia(created.id);
      setMemberId('');
      setSportId('');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo registrar la inscripción. Intente nuevamente.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVigenciaChange = async (is_active: boolean) => {
    setVigenciaError(null);
    setVigenciaSuccess(null);
    const id = enrollmentIdForVigencia.trim();
    if (!id) {
      setVigenciaError('Ingresá el identificador de la inscripción.');
      return;
    }
    setIsUpdatingVigencia(true);
    try {
      await enrollmentsService.update(id, { is_active });
      setVigenciaSuccess(
        is_active
          ? 'Inscripción activada (vigente). El servidor revalidó cupo y duplicados.'
          : 'Inscripción desactivada.'
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la vigencia. Intente nuevamente.';
      setVigenciaError(message);
    } finally {
      setIsUpdatingVigencia(false);
    }
  };

  return (
    <Stack gap="8">
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap="4">
        <Stack gap="1">
          <Heading size="2xl" fontWeight="bold">
            Inscripciones
          </Heading>
          <Text color="fg.muted" fontSize="md" maxW="2xl">
            Registrá la inscripción de un socio a un deporte del catálogo activo. Solo se listan
            deportes no dados de baja; el cupo y el resto de reglas se validan al guardar.
          </Text>
        </Stack>
      </Flex>

      {successMessage ? (
        <Box bg="green.50" borderWidth="1px" borderColor="green.200" borderRadius="md" p="4">
          <Text color="green.700" fontWeight="medium">
            {successMessage}
          </Text>
        </Box>
      ) : null}

      {listError ? (
        <Box
          p="4"
          bg="red.50"
          color="red.700"
          borderRadius="md"
          border="1px solid"
          borderColor="red.200"
        >
          <Text fontWeight="bold">Error al cargar listas:</Text>
          <Text>{listError}</Text>
        </Box>
      ) : null}

      <Box
        bg="bg.panel"
        borderRadius="xl"
        boxShadow="sm"
        borderWidth="1px"
        borderColor="border.muted"
        p={{ base: '6', md: '10' }}
        maxW="xl"
      >
        {isLoading ? (
          <Center minH="200px">
            <Stack align="center" gap="4">
              <Spinner size="xl" color="blue.500" />
              <Text color="fg.muted">Cargando socios y deportes...</Text>
            </Stack>
          </Center>
        ) : (
          <form onSubmit={handleSubmit}>
            <Stack gap="6">
              {submitError ? (
                <Text color="red.600" fontWeight="medium">
                  {submitError}
                </Text>
              ) : null}

              <Field label="Socio" required>
                <SelectRoot
                  collection={memberCollection}
                  value={memberId ? [memberId] : []}
                  onValueChange={(e) => {
                    setMemberId(e.value[0] ?? '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValueText placeholder="Seleccioná un socio" />
                  </SelectTrigger>
                  <SelectContent>
                    {memberCollection.items.map((item) => (
                      <SelectItem item={item} key={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              </Field>

              <Field label="Deporte" required>
                <SelectRoot
                  collection={sportCollection}
                  value={sportId ? [sportId] : []}
                  onValueChange={(e) => {
                    setSportId(e.value[0] ?? '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValueText placeholder="Seleccioná un deporte activo" />
                  </SelectTrigger>
                  <SelectContent>
                    {sportCollection.items.map((item) => (
                      <SelectItem item={item} key={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              </Field>

              <Button
                type="submit"
                colorPalette="blue"
                loading={isSubmitting}
                disabled={!memberId || !sportId}
              >
                Registrar inscripción
              </Button>
            </Stack>
          </form>
        )}
      </Box>

      <Box
        bg="bg.panel"
        borderRadius="xl"
        boxShadow="sm"
        borderWidth="1px"
        borderColor="border.muted"
        p={{ base: '6', md: '8' }}
        maxW="xl"
      >
        <Stack gap="4">
          <Stack gap="1">
            <Heading size="md">Cambiar vigencia de una inscripción</Heading>
            <Text color="fg.muted" fontSize="sm">
              Sin listado de inscripciones (pendiente de otra entrega), podés ingresar un ID
              conocido —por ejemplo el que devuelve el alta recién arriba— para activar o
              desactivar solo el flag <code>is_active</code> en el servidor.
            </Text>
          </Stack>
          {vigenciaSuccess ? (
            <Box
              bg="green.50"
              borderWidth="1px"
              borderColor="green.200"
              borderRadius="md"
              p="3"
            >
              <Text color="green.700" fontWeight="medium">
                {vigenciaSuccess}
              </Text>
            </Box>
          ) : null}
          {vigenciaError ? (
            <Text color="red.600" fontWeight="medium">
              {vigenciaError}
            </Text>
          ) : null}
          <Field
            label="ID de inscripción (UUID)"
            helperText="Se completa solo al registrar arriba; también podés pegar un ID que ya tengas."
          >
            <Input
              value={enrollmentIdForVigencia}
              onChange={(e) => setEnrollmentIdForVigencia(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              fontFamily="mono"
              fontSize="sm"
            />
          </Field>
          <HStack gap="3" flexWrap="wrap">
            <Button
              type="button"
              variant="outline"
              colorPalette="blue"
              loading={isUpdatingVigencia}
              disabled={!enrollmentIdForVigencia.trim()}
              onClick={() => void handleVigenciaChange(false)}
            >
              Desactivar (is_active: false)
            </Button>
            <Button
              type="button"
              colorPalette="blue"
              loading={isUpdatingVigencia}
              disabled={!enrollmentIdForVigencia.trim()}
              onClick={() => void handleVigenciaChange(true)}
            >
              Activar (is_active: true)
            </Button>
          </HStack>
        </Stack>
      </Box>
    </Stack>
  );
}

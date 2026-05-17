import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
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
    loadData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await enrollmentsService.create({ member_id: memberId, sport_id: sportId });
      setSuccessMessage('Inscripción registrada correctamente.');
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

  return (
    <Stack gap="8">
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap="4">
        <Stack gap="1">
          <Heading size="2xl" fontWeight="bold">
            Inscripciones
          </Heading>
          <Text color="fg.muted" fontSize="md" maxW="2xl">
            Registrá la inscripción de un socio a un deporte activo del club. Solo se muestran
            deportes con cupo disponible en catálogo; la validación definitiva ocurre en el
            servidor.
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
    </Stack>
  );
}

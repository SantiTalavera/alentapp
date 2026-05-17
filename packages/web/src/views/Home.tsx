import { Box, SimpleGrid, Heading, Text, VStack } from "@chakra-ui/react";
import { LuUsers, LuMedal, LuClipboardPen, LuDollarSign, LuDumbbell } from "react-icons/lu";
import { SectionCard } from "../components/SectionCard";

export function HomeView() {
  return (
    <Box>
      <VStack gap="6" align="flex-start" mb="12">
        <Heading
          size="4xl"
          fontWeight="extrabold"
          letterSpacing="tight"
          bgGradient="to-r"
          gradientFrom="blue.600"
          gradientTo="cyan.400"
          bgClip="text"
        >
          Bienvenido a Alentapp
        </Heading>
        <Text fontSize="xl" color="fg.muted" maxW="2xl">
          El panel de administración central para gestionar todos los aspectos de tu club.
          Selecciona una sección a continuación para comenzar.
        </Text>
      </VStack>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap="8">
        <SectionCard
          title="Miembros"
          description="Administra el padrón de socios, sus categorías, estados de cuenta y datos personales."
          to="/members"
          icon={LuUsers}
        />

        <SectionCard
          title="Deportes"
          description="Registra nuevos deportes del club: cupos, precios adicionales y requisitos de certificado médico."
          to="/sports"
          icon={LuMedal}
        />

        <SectionCard
          title="Inscripciones"
          description="Asociá socios a deportes activos validando cupo y reglas del club desde un único alta."
          to="/enrollments"
          icon={LuClipboardPen}
        />

        <SectionCard
          title="Pagos"
          description="Consulta el historial de cuotas, modifica vencimientos o registra los pagos efectuados."
          to="/payments"
          icon={LuDollarSign}
         />
        
        <SectionCard
          title="Préstamos"
          description="Administra los préstamos de equipamiento."
          to="/loans"
          icon={LuDumbbell}
        />

        {/* Future sections can be added here following the same pattern */}
        <Box
          p="6"
          bg="bg.muted/30"
          borderRadius="2xl"
          borderWidth="1px"
          borderColor="border.subtle"
          borderStyle="dashed"
          display="flex"
          alignItems="center"
          justifyContent="center"
          minH="250px"
        >
          <VStack>
            <Text color="fg.muted" fontWeight="medium">Próximamente nuevas secciones</Text>
          </VStack>
        </Box>
      </SimpleGrid>
    </Box>
  );
}

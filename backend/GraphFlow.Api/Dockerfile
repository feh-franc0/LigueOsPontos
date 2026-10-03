FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["backend/GraphFlow.Api/GraphFlow.Api.csproj", "backend/GraphFlow.Api/"]
RUN dotnet restore "backend/GraphFlow.Api/GraphFlow.Api.csproj"
COPY . .
RUN dotnet publish "backend/GraphFlow.Api/GraphFlow.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "GraphFlow.Api.dll"]
